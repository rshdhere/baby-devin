package reconcile

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	devinv1 "github.com/rshdhere/devin/packages/sandbox/api/v1"
	"github.com/rshdhere/devin/packages/orchestrator/config"
)

func TestSandboxPodMountsWorkspacePVC(t *testing.T) {
	sbx := &devinv1.Sandbox{
		ObjectMeta: metav1.ObjectMeta{Name: "sbx-123", Namespace: "devin-sandboxes"},
		Spec: devinv1.SandboxSpec{
			CPU:    2,
			Memory: "4Gi",
			Image:  "devin-runtime:latest",
		},
	}

	pod := sandboxPod(sbx, config.Config{})
	if pod.Spec.Containers[0].VolumeMounts[0].MountPath != "/workspace" {
		t.Fatalf("expected /workspace mount, got %s", pod.Spec.Containers[0].VolumeMounts[0].MountPath)
	}
	if pod.Spec.Volumes[0].PersistentVolumeClaim.ClaimName != "sbx-123-workspace" {
		t.Fatalf("unexpected pvc name %s", pod.Spec.Volumes[0].PersistentVolumeClaim.ClaimName)
	}
}
