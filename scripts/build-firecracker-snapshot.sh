#!/usr/bin/env bash
set -euo pipefail

# Create a golden Firecracker snapshot for a runtime.
#
# Prerequisites:
#   - firecracker binary on PATH or FIRECRACKER_BIN
#   - vmlinux at FIRECRACKER_KERNEL_PATH (default /var/lib/devin/linux/vmlinux)
#   - rootfs.ext4 from build-firecracker-rootfs.sh
#   - CNI plugins installed under /opt/cni/bin with fcnet.conflist in /etc/cni/conf.d
#   - CAP_SYS_ADMIN + CAP_NET_ADMIN (run as root on a Linux host)
#
# Usage:
#   sudo ./scripts/build-firecracker-snapshot.sh nextjs

RUNTIME="${1:-nextjs}"
SNAP_DIR="${FIRECRACKER_SNAPSHOT_DIR:-/var/lib/devin/snapshots}/${RUNTIME}"
KERNEL="${FIRECRACKER_KERNEL_PATH:-/var/lib/devin/linux/vmlinux}"
FC_BIN="${FIRECRACKER_BIN:-firecracker}"
ROOTFS="${SNAP_DIR}/rootfs.ext4"
MEM="${SNAP_DIR}/mem.snap"
VM="${SNAP_DIR}/vm.snap"
META="${SNAP_DIR}/meta.json"
WORK="${SNAP_DIR}/.build"

if [[ ! -f "${ROOTFS}" ]]; then
  echo "missing rootfs: ${ROOTFS}" >&2
  echo "run: ./scripts/build-firecracker-rootfs.sh ${RUNTIME}" >&2
  exit 1
fi

if [[ ! -f "${KERNEL}" ]]; then
  echo "missing kernel: ${KERNEL}" >&2
  echo "download a Firecracker-compatible vmlinux and place it at FIRECRACKER_KERNEL_PATH" >&2
  exit 1
fi

if ! command -v "${FC_BIN}" >/dev/null; then
  echo "firecracker binary not found: ${FC_BIN}" >&2
  exit 1
fi

mkdir -p "${WORK}"
SOCKET="${WORK}/firecracker.sock"
rm -f "${SOCKET}" "${MEM}" "${VM}"

cat >"${WORK}/machine.json" <<EOF
{
  "boot-source": {
    "kernel_image_path": "${KERNEL}",
    "boot_args": "console=ttyS0 reboot=k panic=1 pci=off init=/usr/local/bin/devin-runtime-supervisor"
  },
  "drives": [
    {
      "drive_id": "root",
      "path_on_host": "${ROOTFS}",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "machine-config": {
    "vcpu_count": 2,
    "mem_size_mib": 1024
  }
}
EOF

echo "starting firecracker to create golden snapshot for ${RUNTIME}..."
"${FC_BIN}" --api-sock "${SOCKET}" &
FC_PID=$!
cleanup() {
  kill "${FC_PID}" 2>/dev/null || true
  wait "${FC_PID}" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  [[ -S "${SOCKET}" ]] && break
  sleep 0.2
done

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/machine-config" \
  -H 'Content-Type: application/json' \
  -d '{"vcpu_count":2,"mem_size_mib":1024}' >/dev/null

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/boot-source" \
  -H 'Content-Type: application/json' \
  -d "{\"kernel_image_path\":\"${KERNEL}\",\"boot_args\":\"console=ttyS0 reboot=k panic=1 pci=off init=/usr/local/bin/devin-runtime-supervisor\"}" >/dev/null

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/drives/root" \
  -H 'Content-Type: application/json' \
  -d "{\"drive_id\":\"root\",\"path_on_host\":\"${ROOTFS}\",\"is_root_device\":true,\"is_read_only\":false}" >/dev/null

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/actions" \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"InstanceStart"}' >/dev/null

echo "waiting for runtime supervisor to become healthy..."
# The guest IP depends on your CNI setup during snapshot creation.
# For golden snapshots built without CNI, health is best-effort here.
sleep 8

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/actions" \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"SendCtrlAltDel"}' >/dev/null || true

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/vm" \
  -H 'Content-Type: application/json' \
  -d '{"state":"Paused"}' >/dev/null

curl -fsS --unix-socket "${SOCKET}" -X PUT "http://localhost/snapshot/create" \
  -H 'Content-Type: application/json' \
  -d "{\"snapshot_type\":\"Full\",\"snapshot_path\":\"${VM}\",\"mem_file_path\":\"${MEM}\"}" >/dev/null

cat >"${META}" <<EOF
{
  "runtime": "${RUNTIME}",
  "version": "v1",
  "runtimePort": 8080,
  "rootfsPath": "${ROOTFS}",
  "memPath": "${MEM}",
  "snapshotPath": "${VM}"
}
EOF

echo "snapshot ready:"
echo "  meta: ${META}"
echo "  mem:  ${MEM}"
echo "  vm:   ${VM}"
