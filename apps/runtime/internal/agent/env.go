package agent

import "os"

func envValue(req RunRequest, key string) string {
	if req.Env != nil {
		if value := req.Env[key]; value != "" {
			return value
		}
	}
	return os.Getenv(key)
}

func mergeEnv(req RunRequest, extra ...string) []string {
	merged := append([]string{}, extra...)
	if req.Env == nil {
		return merged
	}
	for key, value := range req.Env {
		if value == "" {
			continue
		}
		merged = append(merged, key+"="+value)
	}
	return merged
}
