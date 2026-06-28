package host

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type CreateVMRequest struct {
	Name      string `json:"name"`
	Runtime   string `json:"runtime"`
	CPU       int32  `json:"cpu"`
	Memory    string `json:"memory"`
	TaskID    string `json:"taskId,omitempty"`
	Snapshot  string `json:"snapshot,omitempty"`
}

type VM struct {
	VMID       string `json:"vmId"`
	Host       string `json:"host"`
	RuntimeURL string `json:"runtimeURL"`
	Phase      string `json:"phase"`
	Message    string `json:"message,omitempty"`
}

type StatusResponse struct {
	Host           string `json:"host"`
	CapacityCPU    int32  `json:"capacityCPU"`
	CapacityMemory string `json:"capacityMemory"`
	UsedCPU        int32  `json:"usedCPU"`
	UsedMemory     string `json:"usedMemory"`
	ReadyVMs       int    `json:"readyVMs"`
	ActiveVMs      int    `json:"activeVMs"`
	DefaultRuntime string `json:"defaultRuntime"`
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			// Cold snapshot restores can exceed 30s (VM boot + runtime health).
			Timeout: 120 * time.Second,
		},
	}
}

func (c *Client) CreateVM(ctx context.Context, req CreateVMRequest) (*VM, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/vms", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, readAPIError(resp)
	}

	var vm VM
	if err := json.NewDecoder(resp.Body).Decode(&vm); err != nil {
		return nil, err
	}
	return &vm, nil
}

func (c *Client) GetVM(ctx context.Context, vmID string) (*VM, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/vms/"+vmID, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("vm %s not found", vmID)
	}
	if resp.StatusCode >= 300 {
		return nil, readAPIError(resp)
	}

	var vm VM
	if err := json.NewDecoder(resp.Body).Decode(&vm); err != nil {
		return nil, err
	}
	return &vm, nil
}

func (c *Client) DeleteVM(ctx context.Context, vmID string) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+"/v1/vms/"+vmID, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		return readAPIError(resp)
	}
	return nil
}

func (c *Client) Health(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}
	return nil
}

func (c *Client) Status(ctx context.Context) (*StatusResponse, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/status", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, readAPIError(resp)
	}

	var status StatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return &status, nil
}

func readAPIError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("firecracker host API %s: %s", resp.Status, strings.TrimSpace(string(body)))
}
