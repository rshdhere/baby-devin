# Deploying devin.baby on Kubernetes

This guide walks through a production deployment of the full devin.baby stack on a Kubernetes cluster: the web dashboard, API server, Postgres, task scheduler, orchestrator, and Firecracker execution plane.

## What you are deploying

| Layer | Components | Namespace |
| --- | --- | --- |
| App | Next.js web, Express API server, Postgres | `devin-app` |
| Control plane | Scheduler, Orchestrator | `devin-system` |
| Execution plane | Firecracker host DaemonSet, Sandbox/Machine CRs | `devin-firecracker`, `devin-sandboxes` |

Traffic flow:

```text
User → Ingress → web (3000) + server (8080)
server → scheduler (9091) → orchestrator (9090) → Firecracker microVM → runtime (8080)
```

The repo ships Kubernetes manifests under `deploy/kubernetes/` for the control and execution planes. The app tier (web, server, Postgres) is documented below with example manifests you can apply directly.

## Prerequisites

### Cluster

- Kubernetes **1.28+** with a working default `StorageClass` (for Postgres PVCs if you run DB in-cluster).
- `kubectl` configured against your target cluster.
- An ingress controller (nginx, Traefik, etc.) and TLS certificates (cert-manager recommended).
- A container registry you can push to (Docker Hub, ECR, GCR, etc.).

### Firecracker nodes

Sandboxes run as Firecracker microVMs, not Pods. You need at least one Linux node with:

- **KVM** (`/dev/kvm` accessible)
- **x86_64** (current snapshot tooling targets amd64)
- Enough CPU/RAM for your pool size (default pool: 8 warm VMs, 2 vCPU / 4 GiB per sandbox)
- `hostNetwork: true` support for the firecracker-host DaemonSet

Label Firecracker-capable nodes so the DaemonSet can be targeted:

```sh
kubectl label node <node-name> devin.baby/firecracker=true
```

Then add a `nodeSelector` to `deploy/kubernetes/firecracker/daemonset.yaml` if you do not want the DaemonSet on every node.

### External services

| Service | Purpose |
| --- | --- |
| Postgres 16+ | Auth, dashboard settings, GitHub token storage |
| Resend (or SMTP) | Magic-link and verification emails |
| GitHub OAuth app | Sign-in + repo access for sessions |
| Cursor / Anthropic API keys | Real agent execution (`cursor`, `claude`) |

### Tools on your workstation

- `bun` 1.2+ (build web/server images)
- `docker` + buildx
- `go` 1.22+ (build orchestrator, scheduler, runtime, firecracker-host)
- `kubectl`, `helm` (optional)

---

## 1. Build and push container images

Set your registry prefix:

```sh
export REGISTRY=docker.io/youruser   # or 123456789.dkr.ecr.us-east-1.amazonaws.com/devin
export TAG=latest
```

### App images (CI builds these on push to `main`)

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

### Go services

```sh
# Orchestrator
docker build -f apps/orchestrator/Dockerfile -t $REGISTRY/devin-orchestrator:$TAG . 2>/dev/null \
  || docker build -t $REGISTRY/devin-orchestrator:$TAG \
       --build-arg SERVICE=orchestrator \
       -f - . <<'EOF'
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

# Scheduler (Bun/TypeScript)
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

# Firecracker host
docker build -f apps/firecracker-host/Dockerfile -t $REGISTRY/devin-firecracker-host:$TAG .
```

Push all images:

```sh
docker push $REGISTRY/devin-orchestrator:$TAG
docker push $REGISTRY/devin-scheduler:$TAG
docker push $REGISTRY/devin-firecracker-host:$TAG
```

Update image references in the manifests under `deploy/kubernetes/` before applying (search for `devin-orchestrator:latest`, etc.).

---

## 2. Prepare Firecracker snapshots on host nodes

On each Firecracker node (or a build machine that copies artifacts to `/var/lib/devin`):

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

Snapshots must exist at `/var/lib/devin/snapshots/<runtime>/` on every Firecracker node. The DaemonSet mounts `hostPath: /var/lib/devin`.

See `runtime-images/README.md` for all supported runtimes (`nextjs`, `agent`, `go`, `rust`, `node`, `python`).

---

## 3. Create namespaces and CRDs

```sh
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
```

Verify CRDs:

```sh
kubectl get crd | grep devin.baby
```

Expected: `sandboxes`, `firecrackermachines`, `firecrackerhosts`, `snapshots`.

---

## 4. Deploy the execution plane

### RBAC + orchestrator

```sh
kubectl apply -f deploy/kubernetes/orchestrator/rbac.yaml
kubectl apply -f deploy/kubernetes/orchestrator/deployment.yaml
```

Patch images if needed:

```sh
kubectl -n devin-system set image deployment/devin-orchestrator \
  orchestrator=$REGISTRY/devin-orchestrator:$TAG
```

### Firecracker host DaemonSet

Review `deploy/kubernetes/firecracker/daemonset.yaml` — it runs **privileged** with `hostNetwork: true`.

```sh
kubectl apply -f deploy/kubernetes/firecracker/daemonset.yaml
kubectl -n devin-firecracker set image daemonset/devin-firecracker-host \
  firecracker-host=$REGISTRY/devin-firecracker-host:$TAG
```

Register each host as a `FirecrackerHost` CR (adjust capacity per node):

```sh
kubectl apply -f deploy/kubernetes/firecracker/sample-host.yaml
```

For multi-node clusters, create one `FirecrackerHost` per node pointing at that node's host-network address on port `9092`.

### Scheduler

```sh
kubectl apply -f deploy/kubernetes/scheduler/deployment.yaml
kubectl -n devin-system set image deployment/devin-scheduler \
  scheduler=$REGISTRY/devin-scheduler:$TAG
```

Confirm services:

```sh
kubectl -n devin-system get pods,svc
kubectl -n devin-firecracker get pods
```

---

## 5. Deploy Postgres

Use a managed database (RDS, Cloud SQL, Neon) in production, or run Postgres in-cluster:

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
```

Run schema migrations:

```sh
kubectl -n devin-app port-forward svc/devin-postgres 5432:5432 &
export DATABASE_URL=postgres://postgres:change-me@localhost:5432/devin
bun run migrate
# Apply GitHub settings migration if not picked up by drizzle-kit push:
psql "$DATABASE_URL" -f packages/drizzle/drizzle/0001_github_settings.sql
```

---

## 6. Deploy API server and web

Create an app secret with all server environment variables:

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
  SCHEDULER_URL: "http://devin-scheduler.devin-system.svc:9091"
  RESEND_API_KEY: ""
  RESEND_FROM_EMAIL: "Devin <onboarding@yourdomain.com>"
  RESEND_STRICT: "true"
  GITHUB_CLIENT_ID: ""
  GITHUB_CLIENT_SECRET: ""
  GOOGLE_CLIENT_ID: ""
  GOOGLE_CLIENT_SECRET: ""
  DEFAULT_AGENT: "mock"
  CURSOR_API_KEY: ""
  ANTHROPIC_API_KEY: ""
```

**GitHub OAuth callback URL:** `https://api.yourdomain.com/api/v1/auth/callback/github`

```yaml
# deploy/kubernetes/app/server.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devin-server
  namespace: devin-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: devin-server
  template:
    metadata:
      labels:
        app: devin-server
    spec:
      containers:
        - name: server
          image: youruser/devin-server:latest
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: devin-server
          readinessProbe:
            httpGet:
              path: /api/v1/
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v1/
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: devin-server
  namespace: devin-app
spec:
  selector:
    app: devin-server
  ports:
    - port: 8080
      targetPort: 8080
```

```yaml
# deploy/kubernetes/app/web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devin-web
  namespace: devin-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: devin-web
  template:
    metadata:
      labels:
        app: devin-web
    spec:
      containers:
        - name: web
          image: youruser/devin-web:latest
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: devin-web
  namespace: devin-app
spec:
  selector:
    app: devin-web
  ports:
    - port: 3000
      targetPort: 3000
```

```sh
kubectl apply -f deploy/kubernetes/app/secrets.yaml
kubectl apply -f deploy/kubernetes/app/server.yaml
kubectl apply -f deploy/kubernetes/app/web.yaml
```

---

## 7. Ingress and TLS

Example nginx ingress splitting web and API by host:

```yaml
# deploy/kubernetes/app/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: devin
  namespace: devin-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - yourdomain.com
        - api.yourdomain.com
      secretName: devin-tls
  rules:
    - host: yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: devin-web
                port:
                  number: 3000
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: devin-server
                port:
                  number: 8080
```

```sh
kubectl apply -f deploy/kubernetes/app/ingress.yaml
```

Point DNS `A`/`CNAME` records for both hosts at your ingress load balancer.

---

## 8. Post-deploy verification

### Health checks

```sh
curl -s https://api.yourdomain.com/api/v1/
kubectl -n devin-system logs deploy/devin-orchestrator --tail=50
kubectl -n devin-system logs deploy/devin-scheduler --tail=50
kubectl -n devin-firecracker logs daemonset/devin-firecracker-host --tail=50
```

### End-to-end task (authenticated)

Sign in at `https://yourdomain.com`, connect GitHub, select a repo, and submit a session from the dashboard.

Or via API with a session cookie:

```sh
curl -X POST https://api.yourdomain.com/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -H 'Cookie: better-auth.session_token=...' \
  -d '{"prompt":"Add a README badge","agent":"mock"}'
```

Stream events:

```sh
curl -N https://api.yourdomain.com/api/v1/tasks/<task-id>/events \
  -H 'Cookie: better-auth.session_token=...'
```

Watch CRDs reconcile:

```sh
kubectl -n devin-sandboxes get sandboxes,firecrackermachines -w
```

---

## 9. Configuration reference

### Server (`devin-server` secret)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public API URL (OAuth callbacks) |
| `WEB_APP_URL` | Public web URL (CORS + trusted origins) |
| `SCHEDULER_URL` | `http://devin-scheduler.devin-system.svc:9091` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `RESEND_API_KEY` | Transactional email |
| `DEFAULT_AGENT` | `mock`, `cursor`, or `claude` |

### Scheduler

| Variable | Default in manifest |
| --- | --- |
| `ORCHESTRATOR_URL` | `http://devin-orchestrator.devin-system.svc:9090` |
| `RUNTIME_URL` | Fallback when sandbox URL not ready |
| `DEFAULT_AGENT` | Agent when client omits `agent` |

### Orchestrator

| Variable | Description |
| --- | --- |
| `ORCHESTRATOR_DRY_RUN` | `false` in production |
| `ORCHESTRATOR_CONTROLLER_ENABLED` | `true` — reconciles Sandbox CRDs |
| `SANDBOX_NAMESPACE` | `devin-sandboxes` |
| `FIRECRACKER_NAMESPACE` | `devin-firecracker` |

### Firecracker host

| Variable | Description |
| --- | --- |
| `FIRECRACKER_DRY_RUN` | `false` for real microVMs |
| `FIRECRACKER_POOL_SIZE` | Warm VM pool per host |
| `FIRECRACKER_SNAPSHOT_DIR` | `/var/lib/devin/snapshots` on host |
| `FIRECRACKER_KERNEL_PATH` | `/var/lib/devin/linux/vmlinux` |

---

## 10. Operations

### Upgrades

1. Build and push new images with a version tag.
2. Roll out app tier: `kubectl -n devin-app rollout restart deploy/devin-server deploy/devin-web`
3. Roll out system tier: orchestrator → scheduler → firecracker-host (snapshot-compatible).
4. Run DB migrations before or during server rollout: `bun run migrate`

### Scaling

| Component | Notes |
| --- | --- |
| `devin-web` / `devin-server` | Horizontal — stateless behind ingress |
| `devin-scheduler` | Start with 1 replica; task state is in-memory today |
| `devin-orchestrator` | 1 replica unless you add leader election |
| Firecracker hosts | Add nodes + `FirecrackerHost` CRs; increase `FIRECRACKER_POOL_SIZE` per host |

### Dry-run mode (no KVM)

For testing the control plane without microVMs:

- Set `FIRECRACKER_DRY_RUN=true` on firecracker-host
- Set `ORCHESTRATOR_DRY_RUN=true` on orchestrator
- Scheduler `RUNTIME_URL` can point at a standalone runtime service

This matches local development but does not execute real sandboxes.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Tasks stuck in `sandbox_starting` | Orchestrator logs, `kubectl get sandboxes -n devin-sandboxes` |
| No Firecracker hosts available | `kubectl get firecrackerhosts -n devin-firecracker`, DaemonSet pods |
| Snapshot restore failures | Snapshots on host at `/var/lib/devin/snapshots/<runtime>/`, KVM enabled |
| GitHub sessions fail | OAuth callback URL, `repo` scope, `GITHUB_CLIENT_*` secret |
| Auth emails not sent | `RESEND_API_KEY`, `RESEND_STRICT` |
| Web cannot reach API | `NEXT_PUBLIC_API_URL` baked into web image, CORS `WEB_APP_URL` on server |

---

## 11. Optional: Helm

A scaffold chart lives at `deploy/helm/devin-baby/`. It currently covers runtime values only — extend it to wrap the manifests above, or apply raw YAML until the chart is complete:

```sh
helm upgrade --install devin-baby deploy/helm/devin-baby \
  -n devin-system --create-namespace \
  -f deploy/helm/devin-baby/values.yaml
```

---

## Quick apply order (checklist)

```sh
# 1. Images built and pushed; manifest image refs updated
# 2. Snapshots on Firecracker nodes
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
kubectl apply -f deploy/kubernetes/orchestrator/rbac.yaml
kubectl apply -f deploy/kubernetes/orchestrator/deployment.yaml
kubectl apply -f deploy/kubernetes/firecracker/daemonset.yaml
kubectl apply -f deploy/kubernetes/firecracker/sample-host.yaml
kubectl apply -f deploy/kubernetes/scheduler/deployment.yaml
kubectl apply -f deploy/kubernetes/app/        # postgres, secrets, server, web, ingress
bun run migrate
```

After DNS and TLS propagate, open `https://yourdomain.com`, sign in with GitHub, grant repository access, and start a session.
