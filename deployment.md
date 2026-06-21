# Deploying devin.baby on Kubernetes

This guide covers production deployment of devin.baby: web, API server, Postgres, orchestrator, and Firecracker microVM sandboxes.

Unlike generic container sandboxing (Kata Containers + containerd + devmapper), devin.baby uses **golden snapshot pools** and a **custom runtime supervisor** inside each microVM. We borrow the **dedicated KVM worker pool** idea from Kata/Firecracker-on-K8s guides — labeled nodes, co-located daemons, host-local networking — without adopting Kata itself.

## Choose a deployment path

| Path | When to use | Manifest bundle |
| --- | --- | --- |
| **A — In-cluster KVM pool** | Bare-metal or self-managed K8s with `/dev/kvm` worker nodes | `kubectl apply -k deploy/kubernetes/in-cluster/ --load-restrictor LoadRestrictionsNone` |
| **B — External execution hosts** | Managed K8s without nested KVM (DOKS, GKE standard, EKS) | `kubectl apply -k deploy/kubernetes/external/ --load-restrictor LoadRestrictionsNone` + Droplets |

Both paths share the same control-plane CRDs (`Sandbox`, `FirecrackerMachine`, `FirecrackerHost`) and the same app tier (Postgres, server, web).

---

## Path A — In-cluster KVM worker pool (recommended for bare metal)

Sandboxes run as Firecracker microVMs with host-local networking (`192.168.127.0/24`). The runtime supervisor is only reachable **from the node running `firecracker-host`**, so the scheduler runs as a **co-located DaemonSet** on the same labeled workers.

```text
                         ┌──────────────────────────────────────────────┐
                         │              Kubernetes cluster               │
                         │  devin-app: web, server, postgres            │
                         │  devin-system: orchestrator                   │
                         │  devin-sandboxes: Sandbox / Machine CRs       │
                         │  devin-firecracker:                           │
                         │    firecracker-host DaemonSet (KVM nodes)     │
                         │    scheduler DaemonSet (same nodes)           │
                         │    FirecrackerHost CRs (auto-registered)      │
                         └──────────────────────────────────────────────┘
                                    labeled nodes: devin.baby/firecracker-host=true
                                    /dev/kvm + /var/lib/devin snapshots on each worker
```

Traffic flow:

```text
User → Ingress → web (3000) + server (8080)
server → scheduler on KVM node (:9091, hostNetwork)
scheduler → orchestrator (:9090) → Sandbox CR (preferredHost = node name)
orchestrator → firecracker-host on same node (:9092) → microVM (:8080, 192.168.127.x)
scheduler → runtime inside microVM (host-local CNI)
```

| Layer | Where it runs | Namespace |
| --- | --- | --- |
| App | Kubernetes | `devin-app` |
| Orchestrator | Kubernetes | `devin-system` |
| firecracker-host + scheduler | **KVM worker nodes** (DaemonSets) | `devin-firecracker` |
| CRDs / sandbox state | Kubernetes | `devin-sandboxes`, `devin-firecracker` |

### A.1 Prerequisites

- Kubernetes **1.28+** with at least one worker that has **`/dev/kvm`** (hardware virtualization).
- Do **not** use nested virt on managed-cloud worker nodes (DOKS, etc.) — use Path B instead.
- `kubectl`, ingress + TLS, container registry.
- Fast local disk on KVM workers for `/var/lib/devin`.

### A.2 Build and push images

See [§1 Build and push container images](#1-build-and-push-container-images) below, then:

```sh
kubectl apply -k deploy/kubernetes/in-cluster/ --load-restrictor LoadRestrictionsNone

kubectl -n devin-system set image deployment/devin-orchestrator \
  orchestrator=$REGISTRY/devin-orchestrator:$TAG
kubectl -n devin-firecracker set image daemonset/devin-firecracker-host \
  firecracker-host=$REGISTRY/devin-firecracker-host:$TAG
kubectl -n devin-firecracker set image daemonset/devin-scheduler \
  scheduler=$REGISTRY/devin-scheduler:$TAG
```

### A.3 Prepare snapshots on each KVM worker

On every labeled worker (before or after joining the cluster):

```sh
go build -o apps/runtime/bin/runtime ./apps/runtime/cmd/runtime
sudo mkdir -p /var/lib/devin/linux
sudo curl -fsSL -o /var/lib/devin/linux/vmlinux \
  https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux
docker build -f runtime-images/nextjs/Dockerfile -t devin-runtime-nextjs:latest .
docker build -f runtime-images/agent/Dockerfile -t devin-runtime-agent:latest .
sudo ./scripts/build-firecracker-rootfs.sh nextjs devin-runtime-nextjs:latest
sudo ./scripts/build-firecracker-snapshot.sh nextjs
sudo ./scripts/build-firecracker-rootfs.sh agent devin-runtime-agent:latest
sudo ./scripts/build-firecracker-snapshot.sh agent
```

Verify:

```text
/var/lib/devin/
├── linux/vmlinux
└── snapshots/
    ├── nextjs/
    └── agent/
```

### A.4 Label the KVM worker pool

Inspired by Kata's `katacontainers.io/kata-runtime=true` node label, devin.baby uses:

```sh
kubectl label node <kvm-node-name> devin.baby/firecracker-host=true
```

Optional taint to keep general workloads off execution nodes:

```sh
kubectl taint nodes <kvm-node-name> devin.baby/firecracker-host=true:NoSchedule
```

The orchestrator **node pool controller** (enabled by default) watches labeled nodes and creates a `FirecrackerHost` CR per node:

| CR field | Value |
| --- | --- |
| `metadata.name` | sanitized node name |
| `spec.nodeName` | Kubernetes node name |
| `spec.address` | `http://<node-internal-ip>:9092` |
| `spec.schedulerAddress` | `http://<node-internal-ip>:9091` |

Verify:

```sh
kubectl -n devin-firecracker get firecrackerhosts -o wide
kubectl -n devin-firecracker get pods -o wide
```

### A.5 Scheduler URL for the API server

The scheduler DaemonSet uses `hostNetwork` and listens on `:9091` on each KVM node. Each scheduler sets `SCHEDULER_HOST_NAME` to its node name and passes `spec.preferredHost` when creating sandboxes so VMs land on the local host.

**Single KVM node (simplest):** set server `SCHEDULER_URL` from the registered host:

```sh
kubectl -n devin-firecracker get firecrackerhosts -o jsonpath='{.items[0].spec.schedulerAddress}'
```

**Multiple KVM nodes:** each scheduler holds in-memory task state. Point `SCHEDULER_URL` at one node's `spec.schedulerAddress`, or add sticky routing later. Scale execution by adding labeled nodes; pin traffic per node until shared queue routing is implemented.

### A.6 Post-deploy checks (in-cluster)

```sh
# On the KVM worker
curl -s http://127.0.0.1:9092/v1/status
curl -s http://127.0.0.1:9091/health

# From the cluster
kubectl -n devin-system logs deploy/devin-orchestrator --tail=50
kubectl -n devin-sandboxes get sandboxes,firecrackermachines -w
```

---

## Path B — External execution hosts (managed cloud)

When your Kubernetes workers lack hardware KVM (typical on DOKS/GKE/EKS), run `firecracker-host` + `scheduler` on **dedicated Linux VMs outside the cluster** and register them with `FirecrackerHost` CRs.

```text
                         ┌─────────────────────────────────────┐
                         │           Kubernetes cluster         │
                         │  devin-app: web, server, postgres   │
                         │  devin-system: orchestrator          │
                         │  devin-sandboxes: Sandbox/Machine CRs│
                         │  devin-firecracker: FirecrackerHost  │
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
```

Deploy the control plane:

```sh
kubectl apply -k deploy/kubernetes/external/ --load-restrictor LoadRestrictionsNone
kubectl apply -f deploy/kubernetes/firecracker/external-host.yaml
```

Set `ORCHESTRATOR_NODE_REGISTER_ENABLED=false` is applied automatically by the external kustomize overlay. Register each Droplet manually in `external-host.yaml`.

See [§2–§4 below](#2-prepare-firecracker-snapshots-on-execution-droplets) for Droplet provisioning, snapshot prep, and firewall rules.

---

## Prerequisites (both paths)

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

## 2. Prepare Firecracker snapshots on execution hosts

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

## 4. Deploy Kubernetes control plane

### Path A (in-cluster KVM)

Already covered in [Path A](#path-a--in-cluster-kvm-worker-pool-recommended-for-bare-metal). Use `kubectl apply -k deploy/kubernetes/in-cluster/ --load-restrictor LoadRestrictionsNone`.

### Path B (external hosts) — orchestrator only

```sh
kubectl apply -k deploy/kubernetes/external/ --load-restrictor LoadRestrictionsNone
kubectl -n devin-system set image deployment/devin-orchestrator \
  orchestrator=$REGISTRY/devin-orchestrator:$TAG
```

**Do not** apply `deploy/kubernetes/firecracker/daemonset.yaml` or `deploy/kubernetes/scheduler/daemonset.yaml` on Path B.

Confirm orchestrator env:

```text
ORCHESTRATOR_DRY_RUN=false
ORCHESTRATOR_CONTROLLER_ENABLED=true
ORCHESTRATOR_NODE_REGISTER_ENABLED=false   # Path B only
SANDBOX_NAMESPACE=devin-sandboxes
FIRECRACKER_NAMESPACE=devin-firecracker
```

### 4.3 Register external execution hosts (Path B only)

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

Set `SCHEDULER_URL` to your scheduler endpoint:

- **Path A:** `spec.schedulerAddress` from the registered `FirecrackerHost` CR
- **Path B:** `http://<execution-droplet-private-ip>:9091` or load balancer URL

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

### Scheduler (DaemonSet on KVM nodes or Droplet)

| Variable | Description |
| --- | --- |
| `ORCHESTRATOR_URL` | `http://devin-orchestrator.devin-system.svc:9090` (in-cluster) or LB private IP (Path B) |
| `SCHEDULER_HOST_NAME` | Kubernetes node name — pins sandboxes to the local firecracker-host (Path A) |
| `DEFAULT_AGENT` | `mock`, `cursor`, or `claude` |

### Orchestrator (in Kubernetes)

| Variable | Description |
| --- | --- |
| `ORCHESTRATOR_DRY_RUN` | `false` |
| `ORCHESTRATOR_CONTROLLER_ENABLED` | `true` |
| `ORCHESTRATOR_NODE_REGISTER_ENABLED` | `true` (Path A) / `false` (Path B) |
| `FIRECRACKER_NODE_LABEL` | `devin.baby/firecracker-host` |
| `FIRECRACKER_NAMESPACE` | `devin-firecracker` |

### firecracker-host

| Variable | Description |
| --- | --- |
| `FIRECRACKER_DRY_RUN` | `false` |
| `FIRECRACKER_HOST_NAME` | Node name (Path A) or unique host id (Path B) |
| `FIRECRACKER_POOL_SIZE` | Warm microVM pool per host |
| `FIRECRACKER_SNAPSHOT_DIR` | `/var/lib/devin/snapshots` |
| `FIRECRACKER_HOST_PORT` | `9092` (must match `FirecrackerHost` CR) |

### FirecrackerHost CR

| Field | Description |
| --- | --- |
| `spec.address` | `http://<host-ip>:9092` — firecracker-host HTTP API |
| `spec.schedulerAddress` | `http://<host-ip>:9091` — co-located scheduler (auto-set on Path A) |
| `spec.nodeName` | Kubernetes node name (Path A, auto-set) |
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

**Path A:** label additional KVM workers, copy `/var/lib/devin` snapshots, verify new `FirecrackerHost` CRs appear.

**Path B:** provision a new Droplet (§3), copy snapshots, start containers, apply a new `FirecrackerHost` CR.

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

## 11. Appendix: local dev without KVM

For dry-run local development, use the legacy scheduler Deployment and sample host:

```sh
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
kubectl apply -f deploy/kubernetes/orchestrator/
kubectl apply -f deploy/kubernetes/firecracker/daemonset.yaml
kubectl apply -f deploy/kubernetes/scheduler/deployment.yaml
kubectl apply -f deploy/kubernetes/firecracker/sample-host.yaml
```

Set `FIRECRACKER_DRY_RUN=true` for mock VMs without `/dev/kvm`.

---

## Quick apply checklist

### Path A — in-cluster KVM

```sh
# 1. Build + push images (§1)
# 2. Snapshots on each KVM worker (A.3)
kubectl label node <kvm-node> devin.baby/firecracker-host=true
kubectl apply -k deploy/kubernetes/in-cluster/ --load-restrictor LoadRestrictionsNone
# Set images to your registry (A.2)
# deploy app tier (§5–6), bun run migrate
kubectl -n devin-firecracker get firecrackerhosts
SCHEDULER_URL=$(kubectl -n devin-firecracker get fch -o jsonpath='{.items[0].spec.schedulerAddress}')
```

### Path B — external Droplets

```sh
# 1. Build + push images (§1)
# 2–3. Snapshots + Droplets (§2–3)
kubectl apply -k deploy/kubernetes/external/ --load-restrictor LoadRestrictionsNone
kubectl apply -f deploy/kubernetes/firecracker/external-host.yaml
# Expose orchestrator LB for Droplets (§4.4)
# deploy app tier (§5–6), bun run migrate
```
