package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DryRun               bool
	SandboxNamespace     string
	FirecrackerNamespace string
	AppNamespace         string
	DefaultRuntime       string
	FirecrackerHostURL   string
	RuntimeFallbackURL   string
	ControllerEnabled    bool
}

func LoadFromEnv() Config {
	return Config{
		DryRun:               envBool("ORCHESTRATOR_DRY_RUN", true),
		SandboxNamespace:     envString("SANDBOX_NAMESPACE", "devin-sandboxes"),
		FirecrackerNamespace: envString("FIRECRACKER_NAMESPACE", "devin-firecracker"),
		AppNamespace:         envString("APP_NAMESPACE", "devin-app"),
		DefaultRuntime:       envString("SANDBOX_DEFAULT_RUNTIME", "nextjs"),
		FirecrackerHostURL:   envString("FIRECRACKER_HOST_URL", "http://localhost:9092"),
		RuntimeFallbackURL:   envString("RUNTIME_URL", "http://localhost:8081"),
		ControllerEnabled:    envBool("ORCHESTRATOR_CONTROLLER_ENABLED", true),
	}
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}
