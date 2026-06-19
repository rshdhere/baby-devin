# Runtime images

Sandbox pods run the **devin runtime supervisor** plus a language-specific toolchain. Build every image from the **repository root**.

## Prerequisites

Compile the supervisor binary once:

```sh
go build -o apps/runtime/bin/runtime ./apps/runtime/cmd/runtime
```

## Variants

| Directory | Image tag | Stack |
| --- | --- | --- |
| `nextjs/` | `devin-runtime-nextjs:latest` | Node 22, Bun, Git — Next.js apps |
| `go/` | `devin-runtime-go:latest` | Go 1.23, Git |
| `rust/` | `devin-runtime-rust:latest` | Rust 1.83, OpenSSL/pkg-config |
| `node/` | `devin-runtime-node:latest` | Node 22 |
| `python/` | `devin-runtime-python:latest` | Python 3.12 |

## Build

```sh
docker build -f runtime-images/nextjs/Dockerfile -t devin-runtime-nextjs:latest .
docker build -f runtime-images/go/Dockerfile -t devin-runtime-go:latest .
docker build -f runtime-images/rust/Dockerfile -t devin-runtime-rust:latest .
docker build -f runtime-images/node/Dockerfile -t devin-runtime-node:latest .
docker build -f runtime-images/python/Dockerfile -t devin-runtime-python:latest .
```

## Kubernetes

Set the sandbox image when scheduling (or via `SANDBOX_RUNTIME_IMAGE` on the orchestrator), for example:

```yaml
spec:
  image: devin-runtime-nextjs:latest
```

Each image exposes the runtime supervisor on port **8080** inside the pod.
