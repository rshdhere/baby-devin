package reconcile

import (
	"context"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"

	devinv1 "github.com/rshdhere/devin/packages/sandbox/api/v1"
	"github.com/rshdhere/devin/packages/orchestrator/config"
)

const nodePoolFinalizer = "firecracker.devin.baby/node-pool"

type NodePoolReconciler struct {
	client.Client
	Config config.Config
}

func (r *NodePoolReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	if !r.Config.NodeRegisterEnabled {
		return ctrl.Result{}, nil
	}

	logger := log.FromContext(ctx)

	var node corev1.Node
	if err := r.Get(ctx, req.NamespacedName, &node); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	hostName := firecrackerHostNameForNode(node.Name)
	hostKey := client.ObjectKey{
		Namespace: r.Config.FirecrackerNamespace,
		Name:      hostName,
	}

	if !nodeIsFirecrackerWorker(&node, r.Config.FirecrackerNodeLabel) {
		hostCR := &devinv1.FirecrackerHost{}
		if err := r.Get(ctx, hostKey, hostCR); err != nil {
			return ctrl.Result{}, client.IgnoreNotFound(err)
		}
		if controllerutil.ContainsFinalizer(hostCR, nodePoolFinalizer) {
			controllerutil.RemoveFinalizer(hostCR, nodePoolFinalizer)
			if err := r.Update(ctx, hostCR); err != nil {
				return ctrl.Result{}, err
			}
		}
		if err := r.Delete(ctx, hostCR); err != nil && !apierrors.IsNotFound(err) {
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, nil
	}

	internalIP := nodeInternalAddress(&node)
	if internalIP == "" {
		logger.Info("firecracker node missing internal IP, requeueing", "node", node.Name)
		return ctrl.Result{Requeue: true}, nil
	}

	hostCR := &devinv1.FirecrackerHost{
		ObjectMeta: metav1.ObjectMeta{
			Name:      hostName,
			Namespace: r.Config.FirecrackerNamespace,
			Labels: map[string]string{
				"devin.baby/node": node.Name,
			},
		},
	}

	op, err := controllerutil.CreateOrUpdate(ctx, r.Client, hostCR, func() error {
		if !controllerutil.ContainsFinalizer(hostCR, nodePoolFinalizer) {
			controllerutil.AddFinalizer(hostCR, nodePoolFinalizer)
		}

		hostCR.Spec = devinv1.FirecrackerHostSpec{
			Address: fmt.Sprintf("http://%s:%d", internalIP, r.Config.FirecrackerHostPort),
			Capacity: devinv1.HostCapacity{
				CPU:    r.Config.DefaultHostCPU,
				Memory: r.Config.DefaultHostMemory,
			},
			NodeName:         node.Name,
			SchedulerAddress: fmt.Sprintf("http://%s:%d", internalIP, r.Config.SchedulerPort),
		}
		return nil
	})
	if err != nil {
		return ctrl.Result{}, err
	}

	logger.V(1).Info("registered firecracker host from node",
		"node", node.Name,
		"host", hostName,
		"operation", op,
		"address", hostCR.Spec.Address,
	)

	return ctrl.Result{}, nil
}

func (r *NodePoolReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Node{}).
		Complete(r)
}

func nodeIsFirecrackerWorker(node *corev1.Node, labelKey string) bool {
	return node.Labels[labelKey] == "true"
}

func nodeInternalAddress(node *corev1.Node) string {
	for _, address := range node.Status.Addresses {
		if address.Type == corev1.NodeInternalIP && address.Address != "" {
			return address.Address
		}
	}
	return ""
}

func firecrackerHostNameForNode(nodeName string) string {
	name := strings.ToLower(nodeName)
	name = strings.ReplaceAll(name, "_", "-")
	if len(name) > 63 {
		name = name[:63]
	}
	return strings.Trim(name, "-")
}
