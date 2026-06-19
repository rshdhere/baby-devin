package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DryRun            bool
	SandboxNamespace  string
	AppNamespace      string
	RuntimeImage      string
	WorkspaceSize     string
	StorageClass      string
	GatewayPodLabel   string
	ControllerEnabled bool
}

func LoadFromEnv() Config {
	return Config{
		DryRun:            envBool("ORCHESTRATOR_DRY_RUN", true),
		SandboxNamespace:  envString("SANDBOX_NAMESPACE", "devin-sandboxes"),
		AppNamespace:      envString("APP_NAMESPACE", "devin-app"),
		RuntimeImage:      envString("SANDBOX_RUNTIME_IMAGE", "devin-runtime:latest"),
		WorkspaceSize:     envString("SANDBOX_WORKSPACE_SIZE", "10Gi"),
		StorageClass:      envString("SANDBOX_STORAGE_CLASS", ""),
		GatewayPodLabel:   envString("SANDBOX_GATEWAY_LABEL", "app=devin-server"),
		ControllerEnabled: envBool("ORCHESTRATOR_CONTROLLER_ENABLED", true),
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
