package workspace

import (
	"fmt"
	"log/slog"
	"os"
	"runtime"

	"golang.org/x/sys/unix"
)

const defaultPath = "/workspace"

// DefaultPath is the writable task workspace inside Firecracker microVMs.
func DefaultPath() string {
	return defaultPath
}

// Prepare ensures the task workspace exists and is writable.
//
// Firecracker restores the root drive read-only, so agent/git writes must land
// on a tmpfs mount. Golden snapshots should be taken after this mount runs so
// the restored memory image keeps a writable workspace.
func Prepare(path string) error {
	if path == "" {
		path = defaultPath
	}

	if err := os.MkdirAll(path, 0o755); err != nil {
		return fmt.Errorf("create workspace mount point: %w", err)
	}

	if runtime.GOOS != "linux" {
		return nil
	}

	if mounted, err := isTmpfs(path); err != nil {
		slog.Warn("unable to inspect workspace mount", "path", path, "error", err)
	} else if mounted {
		return nil
	}

	if err := unix.Mount("tmpfs", path, "tmpfs", 0, "size=2G,mode=1777"); err != nil {
		if os.IsPermission(err) || err == unix.EPERM {
			slog.Warn("tmpfs workspace mount skipped; continuing with existing directory", "path", path, "error", err)
			return nil
		}
		return fmt.Errorf("mount tmpfs workspace: %w", err)
	}

	slog.Info("mounted tmpfs workspace", "path", path)
	return nil
}

func isTmpfs(path string) (bool, error) {
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return false, err
	}
	return stat.Type == unix.TMPFS_MAGIC, nil
}
