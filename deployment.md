# Deploying devin.baby on Kubernetes

This guide walks through a production deployment of devin.baby: the web dashboard, API server, Postgres, and Kubernetes control plane — plus **dedicated execution Droplets** that run Firecracker microVMs outside the cluster.

## Recommended production architecture

Sandboxes run as Firecracker microVMs with host-local networking (`192.168.127.0/24`). The runtime supervisor inside each microVM is only reachable **from the machine running `firecracker-host`**, not from arbitrary Pods in Kubernetes.

For that reason, production deployments should:

1. Run **web, server, Postgres, and orchestrator** inside Kubernetes.
2. Run **`firecracker-host` + scheduler** on dedicated Linux Droplets (outside the cluster).
3. Register each execution Droplet as a **`FirecrackerHost` CR** so the in-cluster orchestrator can provision microVMs on it.

```text
                         ┌─────────────────────────────────────┐
                         │           Kubernetes cluster         │
                         │  devin-app: web, server, postgres   │
                         │  devin-system: orchestrator          │
                         │  devin-sandboxes: Sandbox/Machine CRs│
                         │  devin-firecracker: FirecrackerHost │
                         │              CRs only              │
                         └──────────────┬──────────────────────┘
                                        │ orchestrator → :9092
                    VPC / private net   │
         ┌──────────────────────────────┼──────────────────────────────┐
         │  Execution Droplet A         │    Execution Droplet B        │
         │  firecracker-host :9092      │    firecracker-host :9092     │
         │  scheduler        :9091      │    scheduler        :9091     │
         │  microVMs 192.168.127.x      │    microVMs 192.168.127.x   │
         └──────────────────────────────┴──────────────────────────────┘
                                        ▲
                                        │ SCHEDULER_URL
                                   server (in cluster)
```

Traffic flow:

```text
User → Ingress → web (3000) + server (8080)
server → scheduler on execution Droplet (9091)
scheduler → orchestrator in cluster (9090) → Sandbox CR
orchestrator → firecracker-host on Droplet (9092) → microVM runtime (8080, host-local)
scheduler → runtime inside microVM (same Droplet, local CNI IP)
```

| Layer | Where it runs | Namespace / host |
| --- | --- | --- |
| App | Kubernetes | `devin-app` |
| Control plane (orchestrator) | Kubernetes | `devin-system` |
| Control plane (scheduler) | **Execution Droplet** | co-located with firecracker-host |
| CRDs / Sandbox state | Kubernetes | `devin-sandboxes`, `devin-firecracker` |
| Execution (microVMs) | **Execution Droplet** | `/var/lib/devin` on host |

The repo ships Kubernetes manifests under `deploy/kubernetes/` for the in-cluster components. The app tier examples below can be applied directly. Firecracker execution is **not** deployed as an in-cluster DaemonSet in production.

---

## Prerequisites

### Kubernetes cluster

- Kubernetes **1.28+** with a working default `StorageClass` (for Postgres PVCs if you run DB in-cluster).
- `kubectl` configured against your target cluster.
- An ingress controller and TLS (cert-manager recommended).
- A container registry (Docker Hub, DigitalOcean Container Registry, ECR, etc.).

### Execution Droplets (one or more)

Each execution Droplet is a dedicated Linux VM **outside** the cluster (e.g. DigitalOcean Droplet, EC2 instance, Hetzner bare metal):

| Requirement | Notes |
| --- | --- |
| **KVM** | `/dev/kvm` must exist — real hardware virt, not nested virt inside DOKS workers |
| **x86_64** | Current snapshot tooling targets amd64 |
| **CPU / RAM** | Size for warm pool + concurrent sandboxes (e.g. 8 vCPU / 16 GB+ per host) |
| **Disk** | Fast local disk for `/var/lib/devin` snapshots and VM state |
| **Network** | Reachable from orchestrator Pods on `:9092`; can reach orchestrator on `:9090` |
| **Outbound internet** | Git clone, GitHub API, agent API calls from microVMs |

On **DigitalOcean**: use standalone CPU-Optimized Droplets in the **same VPC** as your DOKS cluster. Do not run Firecracker on DOKS worker nodes — nested virtualization is unsupported for production and performs poorly.

### External services

| Service | Purpose |
| --- | --- |
| Postgres 16+ | Auth, dashboard settings, GitHub token storage |
| Resend (or SMTP) | Magic-link and verification emails |
| GitHub OAuth app | Sign-in + repo access for sessions |
| Cursor / Anthropic API keys | Real agent execution (`cursor`, `claude`) |

### Tools on your workstation

- `bun` 1.2+ (build web/server/scheduler images)
- `docker` + buildx
- `go` 1.22+ (build orchestrator, runtime, firecracker-host)
- `kubectl`

---

## 1. Build and push container images

Set your registry prefix:

```sh
export REGISTRY=registry.digitalocean.com/your-registry   # or docker.io/youruser
export TAG=latest
```

### App images

```sh
# From repo root
docker build -f docker/server/Dockerfile -t $REGISTRY/devin-server:$TAG .
docker build -f docker/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_WEB_APP_URL=https://yourdomain.com \
  -t $REGISTRY/devin-web:$TAG .

docker push $REGISTRY/devin-server:$TAG
docker push $REGISTRY/devin-web:$TAG
```

`NEXT_PUBLIC_*` values are baked into the web image at build time. Rebuild web whenever your public URLs change.

### Orchestrator (runs in Kubernetes)

```sh
docker build -t $REGISTRY/devin-orchestrator:$TAG -f - . <<'EOF'
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.work go.work.sum ./
COPY apps/orchestrator apps/orchestrator
COPY packages packages
WORKDIR /src/apps/orchestrator
RUN CGO_ENABLED=0 go build -o /out/orchestrator ./cmd/orchestrator
FROM gcr.io/distroless/static-debian12
COPY --from=build /out/orchestrator /orchestrator
EXPOSE 9090
ENTRYPOINT ["/orchestrator"]
EOF
docker push $REGISTRY/devin-orchestrator:$TAG
```

### Scheduler + firecracker-host (run on execution Droplets)

```sh
docker build -t $REGISTRY/devin-scheduler:$TAG -f - . <<'EOF'
FROM oven/bun:1.2-alpine AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build --filter=@devin/scheduler-app
FROM oven/bun:1.2-alpine
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 9091
CMD ["bun", "run", "--cwd", "apps/scheduler", "start"]
EOF

docker build -f apps/firecracker-host/Dockerfile -t $REGISTRY/devin-firecracker-host:$TAG .

docker push $REGISTRY/devin-scheduler:$TAG
docker push $REGISTRY/devin-firecracker-host:$TAG
```

Update image references in `deploy/kubernetes/` before applying in-cluster manifests.

---

## 2. Prepare Firecracker snapshots on execution Droplets

On each execution Droplet (or a build machine, then copy artifacts to every host):

```sh
# Runtime supervisor binary
go build -o apps/runtime/bin/runtime ./apps/runtime/cmd/runtime

# Kernel (once per host)
sudo mkdir -p /var/lib/devin/linux
sudo curl -fsSL -o /var/lib/devin/linux/vmlinux \
  https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux

# Build runtime Docker images
docker build -f runtime-images/nextjs/Dockerfile -t devin-runtime-nextjs:latest .
docker build -f runtime-images/agent/Dockerfile -t devin-runtime-agent:latest .

# Export rootfs + golden snapshots (requires root + KVM)
sudo ./scripts/build-firecracker-rootfs.sh nextjs devin-runtime-nextjs:latest
sudo ./scripts/build-firecracker-snapshot.sh nextjs
sudo ./scripts/build-firecracker-rootfs.sh agent devin-runtime-agent:latest
sudo ./scripts/build-firecracker-snapshot.sh agent
```

Verify layout:

```text
/var/lib/devin/
├── linux/vmlinux
└── snapshots/
    ├── nextjs/    # rootfs.ext4, mem.snap, vm.snap, meta.json
    └── agent/
```

See `runtime-images/README.md` for all supported runtimes.

**DigitalOcean tip:** after building on one Droplet, snapshot the Droplet image or sync `/var/lib/devin` to additional execution hosts with `rsync` or DO Spaces — avoid rebuilding snapshots on every machine.

---

## 3. Provision execution Droplets

### 3.1 Create the Droplet

Example (DigitalOcean):

- **Image:** Ubuntu 24.04 LTS
- **Size:** CPU-Optimized 8 vCPU / 16 GB RAM (adjust for pool size)
- **VPC:** same VPC as your DOKS cluster
- **Firewall:** see [Network and firewall rules](#network-and-firewall-rules) below

SSH in and verify KVM:

```sh
ls -l /dev/kvm
# crw-rw----+ 1 root kvm ... /dev/kvm
```

### 3.2 Install Docker (or run binaries directly)

```sh
curl -fsSL https://get.docker.com | sh
docker login $REGISTRY
```

### 3.3 Run firecracker-host

```sh
docker run -d --name firecracker-host --restart unless-stopped \
  --privileged \
  --network host \
  -v /var/lib/devin:/var/lib/devin \
  -v /etc/cni/conf.d:/etc/cni/conf.d:ro \
  -e FIRECRACKER_DRY_RUN=false \
  -e FIRECRACKER_HOST_PORT=9092 \
  -e FIRECRACKER_HOST_NAME=fc-prod-01 \
  -e FIRECRACKER_POOL_SIZE=8 \
  -e FIRECRACKER_DEFAULT_RUNTIME=nextjs \
  -e FIRECRACKER_SNAPSHOT_DIR=/var/lib/devin/snapshots \
  -e FIRECRACKER_KERNEL_PATH=/var/lib/devin/linux/vmlinux \
  -e FIRECRACKER_VMM_DIR=/var/lib/devin/vms \
  -e FIRECRACKER_CNI_NETWORK=fcnet \
  -e FIRECRACKER_CNI_CONF_DIR=/etc/cni/conf.d \
  -e FIRECRACKER_CNI_BIN_PATH=/opt/cni/bin \
  -e FIRECRACKER_CAPACITY_CPU=8 \
  -e FIRECRACKER_CAPACITY_MEMORY=16Gi \
  $REGISTRY/devin-firecracker-host:$TAG
```

Install CNI config on the host before starting (from repo):

```sh
sudo mkdir -p /etc/cni/conf.d /opt/cni/bin
sudo cp apps/firecracker-host/config/cni/fcnet.conflist /etc/cni/conf.d/
# CNI plugins are bundled inside the firecracker-host image at /opt/cni/bin
```

Health check:

```sh
curl -s http://127.0.0.1:9092/health
curl -s http://127.0.0.1:9092/v1/status
```

### 3.4 Run scheduler on the same Droplet

The scheduler must run **on the same machine** as firecracker-host so it can reach microVM runtime URLs (`http://192.168.127.x:8080`).

Point it at the in-cluster orchestrator. Use the orchestrator's **VPC-private** endpoint (see [Expose orchestrator to execution Droplets](#expose-orchestrator-to-execution-droplets)).

```sh
docker run -d --name scheduler --restart unless-stopped \
  --network host \
  -e SCHEDULER_PORT=9091 \
  -e ORCHESTRATOR_URL=http://<orchestrator-reachable-ip>:9090 \
  -e DEFAULT_AGENT=mock \
  -e CURSOR_API_KEY= \
  -e ANTHROPIC_API_KEY= \
  $REGISTRY/devin-scheduler:$TAG
```

Health check:

```sh
curl -s http://127.0.0.1:9091/health
```

### 3.5 Multiple execution Droplets

Repeat §3.1–3.4 for each host. Give each a unique `FIRECRACKER_HOST_NAME` (e.g. `fc-prod-01`, `fc-prod-02`). Each runs its own scheduler instance.

Load-balance schedulers from the API server with one of:

- **Single scheduler URL** — point `SCHEDULER_URL` at one Droplet's `:9091` (simplest).
- **External TCP load balancer** — health-check `:9091/health`, round-robin across Droplets.
- **DNS round-robin** — less ideal; no health awareness.

---

## 4. Deploy Kubernetes (control plane + app)

### 4.1 Namespaces and CRDs

```sh
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
kubectl get crd | grep devin.baby
```

Expected: `sandboxes`, `firecrackermachines`, `firecrackerhosts`, `snapshots`.

> **Do not** apply `deploy/kubernetes/firecracker/daemonset.yaml` in production. That manifest is for local/dev only.

### 4.2 Orchestrator

```sh
kubectl apply -f deploy/kubernetes/orchestrator/rbac.yaml
kubectl apply -f deploy/kubernetes/orchestrator/deployment.yaml
kubectl -n devin-system set image deployment/devin-orchestrator \
  orchestrator=$REGISTRY/devin-orchestrator:$TAG
```

Confirm env in the deployment:

```text
ORCHESTRATOR_DRY_RUN=false
ORCHESTRATOR_CONTROLLER_ENABLED=true
SANDBOX_NAMESPACE=devin-sandboxes
FIRECRACKER_NAMESPACE=devin-firecracker
```

**Do not** deploy `deploy/kubernetes/scheduler/deployment.yaml` — scheduler runs on execution Droplets.

### 4.3 Register execution Droplets as FirecrackerHost CRs

Create one CR per execution Droplet. Use the Droplet's **VPC private IP** (reachable from orchestrator Pods):

```yaml
# deploy/kubernetes/firecracker/external-host.yaml
apiVersion: devin.baby/v1
kind: FirecrackerHost
metadata:
  name: fc-prod-01
  namespace: devin-firecracker
spec:
  address: http://10.116.0.12:9092    # execution Droplet private IP
  capacity:
    cpu: 8
    memory: 16Gi
---
apiVersion: devin.baby/v1
kind: FirecrackerHost
metadata:
  name: fc-prod-02
  namespace: devin-firecracker
spec:
  address: http://10.116.0.13:9092
  capacity:
    cpu: 8
    memory: 16Gi
```

```sh
kubectl apply -f deploy/kubernetes/firecracker/external-host.yaml
kubectl -n devin-firecracker get firecrackerhosts -w
```

The orchestrator's `FirecrackerHost` reconciler polls `GET /v1/status` on each address and updates `status.readyVMs`, `status.usedCPU`, etc. The machine controller picks a host with available capacity when creating sandboxes.

Verify from inside the cluster:

```sh
kubectl -n devin-system run curl-test --rm -it --image=curlimages/curl -- \
  curl -s http://10.116.0.12:9092/v1/status
```

### 4.4 Expose orchestrator to execution Droplets

Orchestrator must be reachable from execution Droplets on port **9090**. Options:

| Method | When to use |
| --- | --- |
| **Internal LoadBalancer Service** | DOKS: `type: LoadBalancer` with DO annotation for VPC-only LB |
| **NodePort + VPC IP** | Small clusters; pin to a stable node private IP |
| **kubectl port-forward** | Local testing only |

Example internal LoadBalancer (DigitalOcean):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: devin-orchestrator-lb
  namespace: devin-system
  annotations:
    service.beta.kubernetes.io/do-loadbalancer-type: "REGIONAL_NETWORK"
spec:
  type: LoadBalancer
  selector:
    app: devin-orchestrator
  ports:
    - port: 9090
      targetPort: http
```

Set `ORCHESTRATOR_URL` on each execution Droplet to this LB's private IP.

### 4.5 Network and firewall rules

**Execution Droplet firewall (inbound):**

| Source | Port | Purpose |
| --- | --- | --- |
| DOKS cluster VPC CIDR | `9092` | orchestrator → firecracker-host API |
| DOKS cluster VPC CIDR | `9091` | server → scheduler (if scheduler on this Droplet) |
| Your admin IP | `22` | SSH |

**Execution Droplet firewall (outbound):** allow HTTPS (443) for GitHub, agent APIs, and container registry pulls.

**DOKS / orchestrator:** allow egress to execution Droplet VPC CIDR on `9092`.

MicroVM runtime ports (`192.168.127.x:8080`) stay host-local — do not expose them in the cloud firewall.

---

## 5. Deploy Postgres

Use a managed database (DigitalOcean Managed Postgres, RDS, Neon) in production, or run Postgres in-cluster:

```yaml
# deploy/kubernetes/app/postgres.yaml
apiVersion: v1
kind: Secret
metadata:
  name: devin-postgres
  namespace: devin-app
type: Opaque
stringData:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: change-me
  POSTGRES_DB: devin
  DATABASE_URL: postgres://postgres:change-me@devin-postgres:5432/devin
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: devin-postgres
  namespace: devin-app
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devin-postgres
  namespace: devin-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: devin-postgres
  template:
    metadata:
      labels:
        app: devin-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          envFrom:
            - secretRef:
                name: devin-postgres
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: devin-postgres
---
apiVersion: v1
kind: Service
metadata:
  name: devin-postgres
  namespace: devin-app
spec:
  selector:
    app: devin-postgres
  ports:
    - port: 5432
      targetPort: 5432
```

```sh
kubectl apply -f deploy/kubernetes/app/postgres.yaml
export DATABASE_URL=postgres://postgres:change-me@<postgres-host>:5432/devin
bun run migrate
psql "$DATABASE_URL" -f packages/drizzle/drizzle/0001_github_settings.sql
```

---

## 6. Deploy API server and web

Set `SCHEDULER_URL` to your execution Droplet scheduler endpoint (or load balancer):

```yaml
# deploy/kubernetes/app/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: devin-server
  namespace: devin-app
type: Opaque
stringData:
  BETTER_AUTH_SECRET: "generate-a-long-random-string"
  BETTER_AUTH_URL: "https://api.yourdomain.com"
  WEB_APP_URL: "https://yourdomain.com"
  PORT: "8080"
  DATABASE_URL: "postgres://postgres:change-me@devin-postgres:5432/devin"
  SCHEDULER_URL: "http://10.116.0.12:9091"
  RESEND_API_KEY: ""
  RESEND_FROM_EMAIL: "Devin <onboarding@yourdomain.com>"
  RESEND_STRICT: "true"
  GITHUB_CLIENT_ID: ""
  GITHUB_CLIENT_SECRET: ""
  DEFAULT_AGENT: "mock"
  CURSOR_API_KEY: ""
  ANTHROPIC_API_KEY: ""
```

**GitHub OAuth callback URL:** `https://api.yourdomain.com/api/v1/auth/callback/github`

Deploy server and web (see full manifests in previous sections or `deploy/kubernetes/app/`):

```sh
kubectl apply -f deploy/kubernetes/app/secrets.yaml
kubectl apply -f deploy/kubernetes/app/server.yaml
kubectl apply -f deploy/kubernetes/app/web.yaml
kubectl apply -f deploy/kubernetes/app/ingress.yaml
```

Point DNS at your ingress load balancer.

---

## 7. Post-deploy verification

### In-cluster

```sh
curl -s https://api.yourdomain.com/api/v1/
kubectl -n devin-system logs deploy/devin-orchestrator --tail=50
kubectl -n devin-firecracker get firecrackerhosts
```

### On execution Droplet

```sh
curl -s http://127.0.0.1:9092/v1/status
curl -s http://127.0.0.1:9091/health
```

### End-to-end session

Sign in at `https://yourdomain.com`, connect GitHub, select a repo, submit a session.

Watch sandbox reconciliation:

```sh
kubectl -n devin-sandboxes get sandboxes,firecrackermachines -w
```

On the execution Droplet:

```sh
docker logs -f firecracker-host
docker logs -f scheduler
```

---

## 8. Configuration reference

### Server (`devin-server` secret)

| Variable | Description |
| --- | --- |
| `SCHEDULER_URL` | `http://<execution-droplet-private-ip>:9091` or LB URL |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_URL` / `WEB_APP_URL` | Public URLs for OAuth and CORS |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |

### Scheduler (on execution Droplet)

| Variable | Description |
| --- | --- |
| `ORCHESTRATOR_URL` | `http://<orchestrator-lb-private-ip>:9090` |
| `DEFAULT_AGENT` | `mock`, `cursor`, or `claude` |
| `CURSOR_API_KEY` / `ANTHROPIC_API_KEY` | Agent credentials (passed into microVMs via runtime) |

### Orchestrator (in Kubernetes)

| Variable | Description |
| --- | --- |
| `ORCHESTRATOR_DRY_RUN` | `false` |
| `ORCHESTRATOR_CONTROLLER_ENABLED` | `true` |
| `FIRECRACKER_NAMESPACE` | `devin-firecracker` |

### firecracker-host (on execution Droplet)

| Variable | Description |
| --- | --- |
| `FIRECRACKER_DRY_RUN` | `false` |
| `FIRECRACKER_POOL_SIZE` | Warm microVM pool per host |
| `FIRECRACKER_SNAPSHOT_DIR` | `/var/lib/devin/snapshots` |
| `FIRECRACKER_HOST_PORT` | `9092` (must match `FirecrackerHost` CR) |

### FirecrackerHost CR

| Field | Description |
| --- | --- |
| `spec.address` | `http://<droplet-private-ip>:9092` — HTTP API of firecracker-host |
| `spec.capacity.cpu` | Max vCPUs this host advertises |
| `spec.capacity.memory` | Max memory (e.g. `16Gi`) |

---

## 9. Operations

### Upgrades

1. Build and push new images with a version tag.
2. Roll execution Droplets: `docker pull` + recreate `firecracker-host` and `scheduler` containers (snapshot-compatible changes only for host).
3. Roll in-cluster: `kubectl -n devin-app rollout restart deploy/devin-server deploy/devin-web`
4. Roll orchestrator: `kubectl -n devin-system rollout restart deploy/devin-orchestrator`
5. Run DB migrations: `bun run migrate`

### Scaling execution capacity

1. Provision a new execution Droplet (§3).
2. Copy `/var/lib/devin` snapshots or rebuild them.
3. Start firecracker-host + scheduler.
4. Apply a new `FirecrackerHost` CR with the Droplet's private IP.
5. Optionally add the new scheduler to your `SCHEDULER_URL` load balancer.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| `no firecracker host with capacity` | `kubectl get firecrackerhosts -n devin-firecracker`; host `/v1/status` from orchestrator Pod |
| Orchestrator cannot reach Droplet | VPC, firewall rules, `spec.address` uses private IP |
| Scheduler cannot reach orchestrator | `ORCHESTRATOR_URL`, internal LB health |
| Server cannot reach scheduler | `SCHEDULER_URL`, firewall `:9091` from cluster to Droplet |
| Tasks stuck after sandbox created | Scheduler logs on Droplet; runtime health on `192.168.127.x` (must be same host) |
| Snapshot restore failures | `/var/lib/devin/snapshots/<runtime>/` on Droplet, `/dev/kvm` |
| GitHub sessions fail | OAuth callback URL, `repo` scope |

---

## 10. DigitalOcean quick reference

| Component | DO product |
| --- | --- |
| Kubernetes | DOKS (app + orchestrator only) |
| Execution hosts | CPU-Optimized Droplets, same VPC as DOKS |
| Registry | DO Container Registry |
| Database | Managed Postgres (recommended) or in-cluster |
| Object storage | DO Spaces — optional for snapshot distribution to new Droplets |
| Firewall | DO Cloud Firewall per Droplet + DOKS |

**Do not** run Firecracker on DOKS worker nodes. Use dedicated Droplets with hardware KVM.

---

## 11. Appendix: in-cluster Firecracker DaemonSet (dev only)

For local experimentation inside a cluster that has KVM-capable nodes, you can apply:

```sh
kubectl apply -f deploy/kubernetes/firecracker/daemonset.yaml
kubectl apply -f deploy/kubernetes/scheduler/deployment.yaml
kubectl apply -f deploy/kubernetes/firecracker/sample-host.yaml
```

This runs privileged `firecracker-host` Pods with `hostNetwork: true`. The sample `FirecrackerHost` CR points at in-cluster DNS. **Not recommended for production** — especially on managed clouds with nested virtualization.

For production, use dedicated execution Droplets and external `FirecrackerHost` CRs as described above.

---

## Quick apply checklist

```sh
# ── Execution Droplets (repeat per host) ──
# 1. Verify /dev/kvm
# 2. Build snapshots → /var/lib/devin
# 3. docker run firecracker-host (privileged, host network)
# 4. docker run scheduler (host network, ORCHESTRATOR_URL → cluster)

# ── Kubernetes ──
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
kubectl apply -f deploy/kubernetes/orchestrator/rbac.yaml
kubectl apply -f deploy/kubernetes/orchestrator/deployment.yaml
# Expose orchestrator LB for Droplets
kubectl apply -f deploy/kubernetes/firecracker/external-host.yaml
kubectl apply -f deploy/kubernetes/app/          # postgres, secrets, server, web, ingress
bun run migrate

# ── Verify ──
kubectl -n devin-firecracker get firecrackerhosts
curl https://api.yourdomain.com/api/v1/
# Submit a session from the dashboard
```
