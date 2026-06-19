# Devin (devin.baby)

**devin.baby** is a mini Devin focused on the core software-engineering loop: submit work, get an isolated runtime, run the agent, stream progress, and persist results in `/workspace`.

Sandboxes are an internal implementation detail. Users submit **Tasks**.

## Architecture

Kubernetes is the **control plane**. Firecracker microVMs are the **execution plane**. The runtime HTTP contract never changes — the agent only knows `POST /run`, `POST /terminal`, `POST /git/*`, and `GET /events`.

```mermaid
flowchart TB
  User --> Web
  Web --> Server
  Server --> Scheduler
  Scheduler --> Queue
  Queue --> Orchestrator
  Orchestrator --> SandboxCRD["Sandbox CRD"]
  SandboxController --> SandboxCRD
  SandboxController --> MachineCRD["FirecrackerMachine CR"]
  MachineController --> MachineCRD
  MachineController --> HostSelect["Firecracker Host Selection"]
  HostSelect --> FCHost["firecracker-host daemon"]
  FCHost --> SnapshotPool["Warm Snapshot Pool"]
  SnapshotPool --> microVM["Firecracker microVM"]
  microVM --> Runtime["Runtime Supervisor"]
  Scheduler --> Runtime
  Runtime --> Agent
  Scheduler --> Events
  Events --> Web
```

### Request flow

1. User → `POST /api/v1/tasks` `{ "prompt": "Build a Next.js auth system" }`
2. **Server** authenticates and forwards to **Scheduler**
3. **Scheduler** enqueues work and emits `task.created`
4. Worker creates a **Sandbox CRD** via **Orchestrator** (internal API)
5. **Sandbox controller** creates a **FirecrackerMachine CR** (no Pods)
6. **Machine controller** selects a **FirecrackerHost**, clones a warm snapshot, boots the microVM
7. **Runtime supervisor** starts inside the VM and exposes the fixed HTTP contract
8. Scheduler reads `status.runtimeURL` and calls `POST /run` — never shell on the host
9. Events stream over SSE: `GET /api/v1/tasks/{id}/events`

### Repository layout

```
devin/
├── apps/
│   ├── web/                 # Dashboard
│   ├── server/              # API gateway (auth + task proxy)
│   ├── scheduler/           # Task queue worker + SSE events
│   ├── orchestrator/        # Sandbox CRD controller + internal API
│   ├── firecracker-host/    # Node daemon: VM pool + snapshot manager
│   └── runtime/             # In-VM supervisor (PID 1)
├── packages/
│   ├── orchestrator/        # K8s reconciliation logic
│   ├── sandbox/             # Sandbox + Firecracker CRD types
│   ├── scheduler/           # Task scheduling library
│   ├── services/
│   │   ├── email/           # Resend client
│   │   └── queue/           # Task queue (memory + SQS)
│   ├── events/              # Event bus + SSE helpers
│   └── agent-sdk/           # Runtime HTTP client contract
├── deploy/
│   ├── kubernetes/          # CRDs, RBAC, orchestrator, firecracker-host
│   └── helm/                # Helm chart scaffold
└── runtime-images/          # nextjs, go, rust, node, python → snapshots
```

### Kubernetes namespaces

| Namespace | Workloads |
| --- | --- |
| `devin-app` | web, server |
| `devin-system` | scheduler, orchestrator |
| `devin-sandboxes` | Sandbox + FirecrackerMachine CRs |
| `devin-firecracker` | FirecrackerHost CRs, firecracker-host DaemonSet |

### Runtime supervisor API

Every microVM runs the same runtime supervisor:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/run` | Execute agent task |
| POST | `/terminal` | Shell commands |
| POST | `/git/clone` | Clone repository |
| POST | `/git/commit` | Commit changes |
| POST | `/files/write` | Write workspace files |
| POST | `/browser/open` | Browser automation |
| GET | `/health` | Liveness |
| GET | `/logs` | Supervisor logs |
| GET | `/events` | Runtime event stream |

The orchestrator **never** executes shell commands — it only provisions infrastructure and talks to the runtime over HTTP.

### CRDs

| Kind | Purpose |
| --- | --- |
| `Sandbox` | Task-facing sandbox intent (`taskId`, `runtime`, `cpu`, `memory`) |
| `FirecrackerMachine` | Controller-managed microVM for a sandbox |
| `FirecrackerHost` | Node capacity + firecracker-host API address |
| `Snapshot` | Golden snapshot metadata per runtime image |

### Warm snapshots

Production hosts maintain a pool of ready microVMs restored from golden snapshots (~300ms) instead of cold booting kernels (~8–12s). Each `runtime-images/*` directory builds a snapshot consumed by `firecracker-host`.

Build snapshots on a Linux Firecracker host:

```sh
go build -o apps/runtime/bin/runtime ./apps/runtime/cmd/runtime
sudo ./scripts/build-firecracker-rootfs.sh nextjs devin-runtime-nextjs:latest
sudo ./scripts/build-firecracker-snapshot.sh nextjs
```

Set `FIRECRACKER_DRY_RUN=false` on `firecracker-host` to enable snapshot restore via the Firecracker SDK + CNI (`fcnet`).

### Swappable execution backends

The scheduler → HTTP → runtime path works whether the runtime lives in a Pod, Firecracker VM, Kata, or gVisor. Only the controller + host layer changes.

## Local development

```sh
bun install

# terminal 1 — firecracker-host (dry-run VM pool)
bun run dev --filter=@devin/firecracker-host

# terminal 2 — orchestrator (dry-run, calls firecracker-host)
ORCHESTRATOR_DRY_RUN=true bun run dev --filter=@devin/orchestrator-app

# terminal 3 — runtime supervisor
bun run dev --filter=@devin/runtime

# terminal 4 — scheduler worker
bun run dev --filter=@devin/scheduler-app

# terminal 5 — API + web
bun run dev --filter=@devin/server
bun run dev --filter=@devin/web
```

Create a task:

```sh
curl -X POST http://localhost:8080/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Build a Next.js auth system"}'
```

Stream events:

```sh
curl -N http://localhost:9091/api/v1/tasks/{taskId}/events
```

## Kubernetes deploy

```sh
kubectl apply -f deploy/kubernetes/namespaces.yaml
kubectl apply -f deploy/kubernetes/crd/
kubectl apply -f deploy/kubernetes/firecracker/
kubectl apply -f deploy/kubernetes/orchestrator/
kubectl apply -f deploy/kubernetes/scheduler/
```

Set on server: `SCHEDULER_URL=http://devin-scheduler.devin-system.svc:9091`

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start all apps |
| `bun run build` | Build all apps and packages |
| `bun run lint` | Lint the monorepo |
| `bun run check-types` | TypeScript type checking |
