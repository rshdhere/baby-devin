package reconcile

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	devinv1 "github.com/rshdhere/devin/packages/sandbox/api/v1"
	"github.com/rshdhere/devin/packages/orchestrator/config"
)

const (
	labelManagedBy = "devin.baby/managed-by"
	labelSandbox   = "devin.baby/sandbox"
	managedByValue = "orchestrator"
)

func sandboxLabels(name, taskID string) map[string]string {
	labels := map[string]string{
		labelManagedBy: managedByValue,
		labelSandbox:   name,
	}
	if taskID != "" {
		labels["devin.baby/task-id"] = taskID
	}
	return labels
}

func pvcName(name string) string {
	return fmt.Sprintf("%s-workspace", name)
}

func networkPolicyName(name string) string {
	return fmt.Sprintf("%s-isolation", name)
}

func workspacePVC(sbx *devinv1.Sandbox, cfg config.Config) *corev1.PersistentVolumeClaim {
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName(sbx.Name),
			Namespace: sbx.Namespace,
			Labels:    sandboxLabels(sbx.Name, sbx.Spec.TaskID),
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse(cfg.WorkspaceSize),
				},
			},
		},
	}

	if cfg.StorageClass != "" {
		pvc.Spec.StorageClassName = &cfg.StorageClass
	}

	return pvc
}

func sandboxPod(sbx *devinv1.Sandbox, cfg config.Config) *corev1.Pod {
	image := sbx.Spec.Image
	if image == "" {
		image = cfg.RuntimeImage
	}

	cpu := sbx.Spec.CPU
	if cpu <= 0 {
		cpu = 1
	}

	memory := sbx.Spec.Memory
	if memory == "" {
		memory = "1Gi"
	}

	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      sbx.Name,
			Namespace: sbx.Namespace,
			Labels:    sandboxLabels(sbx.Name, sbx.Spec.TaskID),
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyAlways,
			Containers: []corev1.Container{
				{
					Name:  "runtime",
					Image: image,
					Ports: []corev1.ContainerPort{{ContainerPort: 8080, Name: "http"}},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse(fmt.Sprintf("%d", cpu)),
							corev1.ResourceMemory: resource.MustParse(memory),
						},
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse(fmt.Sprintf("%d", cpu)),
							corev1.ResourceMemory: resource.MustParse(memory),
						},
					},
					VolumeMounts: []corev1.VolumeMount{
						{Name: "workspace", MountPath: "/workspace"},
					},
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "workspace",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
							ClaimName: pvcName(sbx.Name),
						},
					},
				},
			},
		},
	}
}

func sandboxNetworkPolicy(sbx *devinv1.Sandbox, cfg config.Config) *networkingv1.NetworkPolicy {
	gatewayKey, gatewayValue := splitLabelSelector(cfg.GatewayPodLabel)

	ingressFrom := []networkingv1.NetworkPolicyPeer{}
	if gatewayKey != "" {
		ingressFrom = append(ingressFrom, networkingv1.NetworkPolicyPeer{
			NamespaceSelector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"kubernetes.io/metadata.name": cfg.AppNamespace,
				},
			},
			PodSelector: &metav1.LabelSelector{
				MatchLabels: map[string]string{gatewayKey: gatewayValue},
			},
		})
	}

	udp := corev1.ProtocolUDP
	tcp := corev1.ProtocolTCP
	dnsPort := intstr.FromInt32(53)

	return &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      networkPolicyName(sbx.Name),
			Namespace: sbx.Namespace,
			Labels:    sandboxLabels(sbx.Name, sbx.Spec.TaskID),
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{
				MatchLabels: map[string]string{labelSandbox: sbx.Name},
			},
			PolicyTypes: []networkingv1.PolicyType{
				networkingv1.PolicyTypeIngress,
				networkingv1.PolicyTypeEgress,
			},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{From: ingressFrom}},
			Egress: []networkingv1.NetworkPolicyEgressRule{
				{
					To: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"kubernetes.io/metadata.name": "kube-system",
								},
							},
							PodSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{"k8s-app": "kube-dns"},
							},
						},
					},
					Ports: []networkingv1.NetworkPolicyPort{
						{Protocol: &udp, Port: &dnsPort},
						{Protocol: &tcp, Port: &dnsPort},
					},
				},
			},
		},
	}
}

func splitLabelSelector(selector string) (string, string) {
	for i := 0; i < len(selector); i++ {
		if selector[i] == '=' {
			return selector[:i], selector[i+1:]
		}
	}
	return "", ""
}
