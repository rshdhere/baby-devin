package workspace

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestPrepareUsesTmpfsOnLinux(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("tmpfs workspace mounts are only required on Linux microVMs")
	}
	if os.Geteuid() != 0 {
		t.Skip("tmpfs mount test requires root")
	}

	dir := filepath.Join(t.TempDir(), "workspace")
	if err := Prepare(dir); err != nil {
		t.Fatalf("Prepare() error = %v", err)
	}

	mounted, err := isTmpfs(dir)
	if err != nil {
		t.Fatalf("isTmpfs() error = %v", err)
	}
	if !mounted {
		t.Fatalf("expected %s to be backed by tmpfs", dir)
	}

	if err := os.WriteFile(filepath.Join(dir, "probe.txt"), []byte("ok"), 0o644); err != nil {
		t.Fatalf("write probe file: %v", err)
	}
}

func TestDefaultPath(t *testing.T) {
	if DefaultPath() != "/workspace" {
		t.Fatalf("DefaultPath() = %q, want /workspace", DefaultPath())
	}
}
