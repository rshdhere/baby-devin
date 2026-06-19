package vm

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"

	"github.com/rshdhere/devin/apps/firecracker-host/internal/config"
	"github.com/rshdhere/devin/apps/firecracker-host/internal/snapshot"
)

type Launcher struct {
	cfg      config.Config
	snapshot *snapshot.Store
}

func NewLauncher(cfg config.Config, snapshotStore *snapshot.Store) *Launcher {
	return &Launcher{cfg: cfg, snapshot: snapshotStore}
}

func (l *Launcher) Restore(ctx context.Context, vmID, name, runtime string, cpu int32, memory string) (*Instance, error) {
	meta, err := l.snapshot.Resolve(runtime)
	if err != nil {
		return nil, err
	}

	memMiB, err := config.ParseMemoryMiB(memory)
	if err != nil {
		return nil, err
	}
	if cpu <= 0 {
		cpu = 1
	}

	vmDir := filepath.Join(l.cfg.VMMDir, vmID)
	if err := os.MkdirAll(vmDir, 0o755); err != nil {
		return nil, err
	}

	socketPath := filepath.Join(vmDir, "firecracker.sock")
	logPath := filepath.Join(vmDir, "firecracker.log")

	fcCfg := firecracker.Config{
		SocketPath: socketPath,
		LogPath:    logPath,
		Drives: []models.Drive{
			{
				DriveID:      firecracker.String("root"),
				IsRootDevice: firecracker.Bool(true),
				IsReadOnly:   firecracker.Bool(true),
				PathOnHost:   firecracker.String(meta.RootfsPath),
			},
		},
		NetworkInterfaces: firecracker.NetworkInterfaces{
			{
				CNIConfiguration: &firecracker.CNIConfiguration{
					NetworkName: l.cfg.CNINetworkName,
					IfName:      "eth0",
					ConfDir:     l.cfg.CNIConfDir,
					BinPath:     []string{l.cfg.CNIBinPath},
				},
			},
		},
		MachineCfg: models.MachineConfiguration{
			VcpuCount:  firecracker.Int64(int64(cpu)),
			MemSizeMib: firecracker.Int64(memMiB),
		},
	}

	vmmCtx, cancel := context.WithCancel(ctx)
	cmd := firecracker.VMCommandBuilder{}.
		WithBin(l.cfg.FirecrackerBin).
		WithSocketPath(socketPath).
		Build(vmmCtx)

	machine, err := firecracker.NewMachine(
		vmmCtx,
		fcCfg,
		firecracker.WithProcessRunner(cmd),
		firecracker.WithSnapshot(meta.MemPath, meta.SnapshotPath, func(sc *firecracker.SnapshotConfig) {
			sc.ResumeVM = true
		}),
	)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("create firecracker machine: %w", err)
	}

	if err := machine.Start(vmmCtx); err != nil {
		cancel()
		_ = machine.StopVMM()
		return nil, fmt.Errorf("start firecracker machine: %w", err)
	}

	ip, err := machineIP(machine)
	if err != nil {
		cancel()
		_ = machine.StopVMM()
		return nil, err
	}

	runtimeURL := fmt.Sprintf("http://%s:%d", ip.String(), meta.RuntimePort)
	instance := &Instance{
		ID:         vmID,
		Name:       name,
		Runtime:    runtime,
		IP:         ip,
		RuntimeURL: runtimeURL,
		Phase:      "Running",
		Message:    "microVM restored from snapshot",
		machine:    machine,
		cancel:     cancel,
	}

	if err := waitForRuntimeHealth(ctx, instance.RuntimeURL, 30*time.Second); err != nil {
		_ = instance.Shutdown(context.Background())
		return nil, fmt.Errorf("runtime health check failed: %w", err)
	}

	return instance, nil
}

func machineIP(machine *firecracker.Machine) (net.IP, error) {
	if len(machine.Cfg.NetworkInterfaces) == 0 {
		return nil, fmt.Errorf("firecracker machine has no network interfaces")
	}
	staticCfg := machine.Cfg.NetworkInterfaces[0].StaticConfiguration
	if staticCfg == nil || staticCfg.IPConfiguration == nil {
		return nil, fmt.Errorf("firecracker machine has no static IP configuration")
	}
	if staticCfg.IPConfiguration.IPAddr.IP == nil {
		return nil, fmt.Errorf("firecracker machine IP is empty")
	}
	return staticCfg.IPConfiguration.IPAddr.IP, nil
}

func waitForRuntimeHealth(ctx context.Context, runtimeURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		reqCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, runtimeURL+"/health", nil)
		if err != nil {
			cancel()
			return err
		}
		resp, err := http.DefaultClient.Do(req)
		cancel()
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode < 300 {
				return nil
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(300 * time.Millisecond):
		}
	}
	return fmt.Errorf("runtime at %s did not become healthy within %s", runtimeURL, timeout)
}
