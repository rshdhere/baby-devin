package main

import (
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/rshdhere/devin/apps/runtime/internal/supervisor"
)

func main() {
	port := envInt("RUNTIME_PORT", 8081)
	workspace := envString("RUNTIME_WORKSPACE", "/tmp/devin-workspace")

	if err := os.MkdirAll(workspace, 0o755); err != nil {
		slog.Error("failed to create workspace", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              ":" + strconv.Itoa(port),
		Handler:           supervisor.New(workspace).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	slog.Info("runtime supervisor listening", "addr", srv.Addr, "workspace", workspace)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("runtime supervisor failed", "error", err)
		os.Exit(1)
	}
}

func envInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
