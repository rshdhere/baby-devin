package pool

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/rs/xid"

	"github.com/rshdhere/devin/apps/firecracker-host/internal/config"
	"github.com/rshdhere/devin/apps/firecracker-host/internal/snapshot"
	"github.com/rshdhere/devin/apps/firecracker-host/internal/vm"
)

type VMRecord struct {
	VMID       string `json:"vmId"`
	Name       string `json:"name"`
	Host       string `json:"host"`
	Runtime    string `json:"runtime"`
	RuntimeURL string `json:"runtimeURL"`
	Phase      string `json:"phase"`
	Message    string `json:"message,omitempty"`
}

type HostStatus struct {
	Host         string `json:"host"`
	CapacityCPU  int32  `json:"capacityCPU"`
	CapacityMem  string `json:"capacityMemory"`
	UsedCPU      int32  `json:"usedCPU"`
	UsedMemory   string `json:"usedMemory"`
	ReadyVMs     int    `json:"readyVMs"`
	ActiveVMs    int    `json:"activeVMs"`
	DefaultRun   string `json:"defaultRuntime"`
}

type Manager struct {
	cfg      config.Config
	launcher *vm.Launcher
	hostName string

	mu         sync.RWMutex
	vms        map[string]*vm.Instance
	assigned   map[string]*vm.Instance
	vmCPU      map[string]int32
	ready      map[string]chan *vm.Instance
	readyCount int
	usedCPU    int32
}

func NewManager(cfg config.Config) (*Manager, error) {
	if err := cfg.ValidateProduction(); err != nil {
		return nil, err
	}

	m := &Manager{
		cfg:      cfg,
		hostName: cfg.HostName,
		vms:      make(map[string]*vm.Instance),
		assigned: make(map[string]*vm.Instance),
		vmCPU:    make(map[string]int32),
		ready:    make(map[string]chan *vm.Instance),
	}

	if cfg.DryRun {
		m.readyCount = cfg.PoolSize
		return m, nil
	}

	store := snapshot.NewStore(cfg.SnapshotDir, cfg.KernelPath, cfg.RuntimePort, cfg.WarmVCPU, cfg.WarmMemoryMiB)
	m.launcher = vm.NewLauncher(cfg, store)
	return m, nil
}

func (m *Manager) snapshotStore() *snapshot.Store {
	return snapshot.NewStore(m.cfg.SnapshotDir, m.cfg.KernelPath, m.cfg.RuntimePort, m.cfg.WarmVCPU, m.cfg.WarmMemoryMiB)
}

func (m *Manager) Start(ctx context.Context) {
	if m.cfg.DryRun {
		go m.warmDryRunPool(ctx)
		return
	}

	runtimes, err := m.snapshotStore().ListRuntimes()
	if err != nil {
		slog.Error("failed to list snapshot runtimes", "error", err)
		runtimes = []string{m.cfg.DefaultRuntime}
	}
	if len(runtimes) == 0 {
		runtimes = []string{m.cfg.DefaultRuntime}
	}

	for _, runtime := range runtimes {
		queue := make(chan *vm.Instance, m.cfg.PoolSize)
		m.mu.Lock()
		m.ready[runtime] = queue
		m.mu.Unlock()

		go m.warmRuntimePool(ctx, runtime, queue)
	}
}

func (m *Manager) warmDryRunPool(ctx context.Context) {
	for i := 0; i < m.cfg.PoolSize; i++ {
		select {
		case <-ctx.Done():
			return
		default:
			m.mu.Lock()
			m.readyCount++
			m.mu.Unlock()
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func (m *Manager) warmRuntimePool(ctx context.Context, runtime string, queue chan *vm.Instance) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if len(queue) >= m.cfg.PoolSize {
			time.Sleep(time.Second)
			continue
		}

		instance, err := m.launchWarm(ctx, runtime)
		if err != nil {
			slog.Error("failed to warm microVM", "runtime", runtime, "error", err)
			time.Sleep(5 * time.Second)
			continue
		}

		select {
		case <-ctx.Done():
			_ = instance.Shutdown(context.Background())
			return
		case queue <- instance:
			m.mu.Lock()
			m.readyCount++
			m.mu.Unlock()
			slog.Info("warmed microVM", "runtime", runtime, "vmId", instance.ID, "runtimeURL", instance.RuntimeURL)
		}
	}
}

func (m *Manager) launchWarm(ctx context.Context, runtime string) (*vm.Instance, error) {
	vmID := xid.New().String()
	return m.launcher.Restore(
		ctx,
		vmID,
		"warm-"+vmID,
		runtime,
		m.cfg.WarmVCPU,
		fmt.Sprintf("%dMi", m.cfg.WarmMemoryMiB),
	)
}

func (m *Manager) Create(name, runtime, taskID string, cpu int32, memory string) (*VMRecord, error) {
	_ = taskID

	if runtime == "" {
		runtime = m.cfg.DefaultRuntime
	}

	if m.cfg.DryRun {
		return m.createDryRun(name, runtime)
	}

	instance, err := m.acquireRuntime(ctxBackground(), runtime, name, cpu, memory)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.assigned[instance.ID] = instance
	m.vms[instance.ID] = instance
	m.vmCPU[instance.ID] = cpu
	m.usedCPU += cpu
	m.mu.Unlock()

	return m.recordFromInstance(instance), nil
}

func (m *Manager) createDryRun(name, runtime string) (*VMRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	vmID := xid.New().String()
	record := &VMRecord{
		VMID:       vmID,
		Name:       name,
		Host:       m.hostName,
		Runtime:    runtime,
		RuntimeURL: m.cfg.RuntimeFallback,
		Phase:      "Running",
		Message:    "dry-run microVM assigned from warm pool",
	}
	m.vms[vmID] = &vm.Instance{
		ID:         vmID,
		Name:       name,
		Runtime:    runtime,
		RuntimeURL: m.cfg.RuntimeFallback,
		Phase:      "Running",
		Message:    record.Message,
	}
	if m.readyCount > 0 {
		m.readyCount--
	}
	return record, nil
}

func (m *Manager) acquireRuntime(ctx context.Context, runtime, name string, cpu int32, memory string) (*vm.Instance, error) {
	m.mu.RLock()
	queue := m.ready[runtime]
	m.mu.RUnlock()

	if queue != nil {
		select {
		case warm := <-queue:
			m.mu.Lock()
			if m.readyCount > 0 {
				m.readyCount--
			}
			m.mu.Unlock()
			warm.Name = name
			warm.Message = "assigned from warm pool"
			return warm, nil
		default:
		}
	}

	vmID := xid.New().String()
	instance, err := m.launcher.Restore(ctx, vmID, name, runtime, cpu, memory)
	if err != nil {
		return nil, err
	}
	return instance, nil
}

func (m *Manager) Get(vmID string) (*VMRecord, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if instance, ok := m.vms[vmID]; ok {
		return m.recordFromInstance(instance), nil
	}
	if m.cfg.DryRun {
		return nil, fmt.Errorf("vm %s not found", vmID)
	}
	return nil, fmt.Errorf("vm %s not found", vmID)
}

func (m *Manager) Delete(vmID string) error {
	m.mu.Lock()
	instance, ok := m.vms[vmID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("vm %s not found", vmID)
	}
	cpu := m.vmCPU[vmID]
	delete(m.vms, vmID)
	delete(m.assigned, vmID)
	delete(m.vmCPU, vmID)
	if m.usedCPU >= cpu {
		m.usedCPU -= cpu
	}
	m.mu.Unlock()

	if m.cfg.DryRun {
		m.mu.Lock()
		m.readyCount++
		m.mu.Unlock()
		return nil
	}

	if err := instance.Shutdown(context.Background()); err != nil {
		slog.Warn("failed to shutdown microVM", "vmId", vmID, "error", err)
	}
	return nil
}

func (m *Manager) ReadyVMs() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.readyCount
}

func (m *Manager) Status() HostStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return HostStatus{
		Host:        m.hostName,
		CapacityCPU: m.cfg.CapacityCPU,
		CapacityMem: m.cfg.CapacityMemory,
		UsedCPU:     m.usedCPU,
		UsedMemory:  formatUsedMemoryMiB(m.usedCPU * 512),
		ReadyVMs:    m.readyCount,
		ActiveVMs:   len(m.assigned),
		DefaultRun:  m.cfg.DefaultRuntime,
	}
}

func (m *Manager) recordFromInstance(instance *vm.Instance) *VMRecord {
	return &VMRecord{
		VMID:       instance.ID,
		Name:       instance.Name,
		Host:       m.hostName,
		Runtime:    instance.Runtime,
		RuntimeURL: instance.RuntimeURL,
		Phase:      instance.Phase,
		Message:    instance.Message,
	}
}

func ctxBackground() context.Context {
	return context.Background()
}

func formatUsedMemoryMiB(mib int32) string {
	if mib >= 1024 {
		return fmt.Sprintf("%dGi", mib/1024)
	}
	return fmt.Sprintf("%dMi", mib)
}
