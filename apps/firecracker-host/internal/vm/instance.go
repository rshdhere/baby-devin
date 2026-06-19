package vm

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
)

type Instance struct {
	ID         string
	Name       string
	Runtime    string
	IP         net.IP
	RuntimeURL string
	Phase      string
	Message    string

	machine *firecracker.Machine
	cancel  context.CancelFunc
}

func (i *Instance) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, i.RuntimeURL+"/health", nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("runtime health returned %s", resp.Status)
	}
	return nil
}

func (i *Instance) Shutdown(ctx context.Context) error {
	if i.cancel != nil {
		i.cancel()
	}
	if i.machine == nil {
		return nil
	}
	return i.machine.StopVMM()
}
