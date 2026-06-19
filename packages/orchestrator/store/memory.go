package store

import (
	"context"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	devinv1 "github.com/rshdhere/devin/packages/sandbox/api/v1"
)

type MemoryStore struct {
	mu        sync.RWMutex
	namespace string
	items     map[string]*devinv1.Sandbox
}

func NewMemoryStore(namespace string) *MemoryStore {
	return &MemoryStore{
		namespace: namespace,
		items:     make(map[string]*devinv1.Sandbox),
	}
}

func (s *MemoryStore) Create(ctx context.Context, sandbox *devinv1.Sandbox) error {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.items[sandbox.Name]; exists {
		return ErrAlreadyExists
	}

	now := metav1.Now()
	copy := sandbox.DeepCopy()
	copy.Namespace = s.namespace
	copy.CreationTimestamp = now
	copy.Status = devinv1.SandboxStatus{
		Phase:   devinv1.SandboxPhasePending,
		Message: "queued for local reconciliation",
	}
	s.items[sandbox.Name] = copy

	go s.simulateProvision(sandbox.Name)
	return nil
}

func (s *MemoryStore) Get(_ context.Context, name string) (*devinv1.Sandbox, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	item, ok := s.items[name]
	if !ok {
		return nil, ErrNotFound
	}
	return item.DeepCopy(), nil
}

func (s *MemoryStore) List(_ context.Context) ([]devinv1.Sandbox, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items := make([]devinv1.Sandbox, 0, len(s.items))
	for _, item := range s.items {
		items = append(items, *item.DeepCopy())
	}
	return items, nil
}

func (s *MemoryStore) Delete(_ context.Context, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[name]
	if !ok {
		return ErrNotFound
	}

	item.Status.Phase = devinv1.SandboxPhaseTerminating
	item.Status.Message = "deleting sandbox"
	delete(s.items, name)
	return nil
}

func (s *MemoryStore) simulateProvision(name string) {
	time.Sleep(500 * time.Millisecond)

	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[name]
	if !ok {
		return
	}

	item.Status = devinv1.SandboxStatus{
		Phase:   devinv1.SandboxPhaseRunning,
		PodName: name,
		PVCName: name + "-workspace",
		Message: "local dry-run sandbox ready",
	}
}
