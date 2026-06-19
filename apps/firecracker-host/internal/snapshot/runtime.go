package snapshot

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Metadata struct {
	Runtime     string `json:"runtime"`
	Version     string `json:"version"`
	RuntimePort int    `json:"runtimePort"`
	RootfsPath  string `json:"rootfsPath"`
	MemPath     string `json:"memPath"`
	SnapshotPath string `json:"snapshotPath"`
}

type Store struct {
	baseDir     string
	kernelPath  string
	runtimePort int
}

func NewStore(baseDir, kernelPath string, runtimePort int) *Store {
	return &Store{
		baseDir:     baseDir,
		kernelPath:  kernelPath,
		runtimePort: runtimePort,
	}
}

func (s *Store) Resolve(runtime string) (*Metadata, error) {
	runtime = strings.TrimSpace(runtime)
	if runtime == "" {
		return nil, fmt.Errorf("runtime is required")
	}

	dir := filepath.Join(s.baseDir, runtime)
	metaPath := filepath.Join(dir, "meta.json")

	if data, err := os.ReadFile(metaPath); err == nil {
		var meta Metadata
		if err := json.Unmarshal(data, &meta); err != nil {
			return nil, fmt.Errorf("decode snapshot metadata: %w", err)
		}
		meta.Runtime = runtime
		if meta.RuntimePort == 0 {
			meta.RuntimePort = s.runtimePort
		}
		if meta.RootfsPath == "" {
			meta.RootfsPath = filepath.Join(dir, "rootfs.ext4")
		}
		if meta.MemPath == "" {
			meta.MemPath = filepath.Join(dir, "mem.snap")
		}
		if meta.SnapshotPath == "" {
			meta.SnapshotPath = filepath.Join(dir, "vm.snap")
		}
		return s.validate(&meta)
	}

	meta := &Metadata{
		Runtime:      runtime,
		Version:      "v1",
		RuntimePort:  s.runtimePort,
		RootfsPath:   filepath.Join(dir, "rootfs.ext4"),
		MemPath:      filepath.Join(dir, "mem.snap"),
		SnapshotPath: filepath.Join(dir, "vm.snap"),
	}
	return s.validate(meta)
}

func (s *Store) KernelPath() string {
	return s.kernelPath
}

func (s *Store) validate(meta *Metadata) (*Metadata, error) {
	for _, path := range []struct {
		name string
		path string
	}{
		{"rootfs", meta.RootfsPath},
		{"mem snapshot", meta.MemPath},
		{"vm snapshot", meta.SnapshotPath},
	} {
		if _, err := os.Stat(path.path); err != nil {
			return nil, fmt.Errorf("snapshot %s for runtime %q missing at %s: %w", path.name, meta.Runtime, path.path, err)
		}
	}
	if _, err := os.Stat(s.kernelPath); err != nil {
		return nil, fmt.Errorf("kernel image missing at %s: %w", s.kernelPath, err)
	}
	return meta, nil
}

func (s *Store) ListRuntimes() ([]string, error) {
	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	runtimes := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, err := s.Resolve(entry.Name()); err == nil {
			runtimes = append(runtimes, entry.Name())
		}
	}
	return runtimes, nil
}
