package workspace

import (
	"log/slog"
	"os"
	"runtime"
	"strings"
)

const defaultResolvConf = `nameserver 8.8.8.8
nameserver 1.1.1.1
nameserver 8.8.4.4
`

// EnsureDNS writes a public resolver config when the guest has none.
// Firecracker snapshots often inherit a Docker stub resolv.conf that cannot
// resolve external hosts inside the microVM.
func EnsureDNS() {
	if runtime.GOOS != "linux" {
		return
	}

	data, err := os.ReadFile("/etc/resolv.conf")
	if err == nil && hasUsableNameserver(string(data)) {
		return
	}

	if err := os.WriteFile("/etc/resolv.conf", []byte(defaultResolvConf), 0o644); err != nil {
		slog.Warn("failed to configure guest DNS", "error", err)
		return
	}

	slog.Info("configured guest DNS resolvers for sandbox egress")
}

func hasUsableNameserver(content string) bool {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "nameserver ") {
			continue
		}
		server := strings.TrimSpace(strings.TrimPrefix(line, "nameserver "))
		if server != "" && server != "127.0.0.53" && server != "127.0.0.1" {
			return true
		}
	}
	return false
}
