package supervisor

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Server struct {
	workspace string
	logs      []string
	mu        sync.RWMutex
}

func New(workspace string) *Server {
	return &Server{
		workspace: workspace,
		logs:      []string{},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /logs", s.handleLogs)
	mux.HandleFunc("POST /run", s.handleRun)
	mux.HandleFunc("POST /terminal", s.handleTerminal)
	mux.HandleFunc("POST /git/clone", s.handleGitClone)
	mux.HandleFunc("POST /git/commit", s.handleGitCommit)
	mux.HandleFunc("POST /files/write", s.handleFilesWrite)
	mux.HandleFunc("POST /browser/open", s.handleBrowserOpen)
	mux.HandleFunc("GET /events", s.handleEvents)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleLogs(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"logs": s.logs})
}

type runRequest struct {
	TaskID string `json:"taskId"`
	Prompt string `json:"prompt"`
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	s.appendLog("agent running task " + req.TaskID + ": " + req.Prompt)

	writeJSON(w, http.StatusOK, map[string]any{
		"taskId":  req.TaskID,
		"status":  "completed",
		"message": "agent accepted prompt",
		"output":  "devin.baby runtime processed: " + req.Prompt,
	})
}

type terminalRequest struct {
	Command string `json:"command"`
	CWD     string `json:"cwd"`
}

func (s *Server) handleTerminal(w http.ResponseWriter, r *http.Request) {
	var req terminalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.appendLog("terminal: " + req.Command)
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted", "command": req.Command})
}

type gitCloneRequest struct {
	URL  string `json:"url"`
	Path string `json:"path"`
}

func (s *Server) handleGitClone(w http.ResponseWriter, r *http.Request) {
	var req gitCloneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.appendLog("git clone " + req.URL)
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted", "url": req.URL})
}

type gitCommitRequest struct {
	Message string   `json:"message"`
	Paths   []string `json:"paths"`
}

func (s *Server) handleGitCommit(w http.ResponseWriter, r *http.Request) {
	var req gitCommitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.appendLog("git commit: " + req.Message)
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted", "message": req.Message})
}

type fileWriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (s *Server) handleFilesWrite(w http.ResponseWriter, r *http.Request) {
	var req fileWriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	target := filepath.Join(s.workspace, filepath.Clean("/"+req.Path))
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.WriteFile(target, []byte(req.Content), 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.appendLog("file write " + req.Path)
	writeJSON(w, http.StatusOK, map[string]string{"status": "written", "path": req.Path})
}

type browserOpenRequest struct {
	URL string `json:"url"`
}

func (s *Server) handleBrowserOpen(w http.ResponseWriter, r *http.Request) {
	var req browserOpenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s.appendLog("browser open " + req.URL)
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted", "url": req.URL})
}

func (s *Server) handleEvents(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("event: runtime.ready\ndata: {\"message\":\"supervisor online\"}\n\n"))
}

func (s *Server) appendLog(line string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logs = append(s.logs, time.Now().UTC().Format(time.RFC3339)+" "+line)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
