package reconcile

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

	devinv1 "github.com/rshdhere/devin/packages/sandbox/api/v1"
	"github.com/rshdhere/devin/packages/orchestrator/config"
)

const sandboxFinalizer = "sandbox.devin.baby/finalizer"

type SandboxReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Config config.Config
}

func (r *SandboxReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var sandbox devinv1.Sandbox
	if err := r.Get(ctx, req.NamespacedName, &sandbox); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if !sandbox.DeletionTimestamp.IsZero() {
		return r.finalize(ctx, &sandbox)
	}

	if !controllerutil.ContainsFinalizer(&sandbox, sandboxFinalizer) {
		controllerutil.AddFinalizer(&sandbox, sandboxFinalizer)
		if err := r.Update(ctx, &sandbox); err != nil {
			return ctrl.Result{}, err
		}
	}

	if err := r.ensurePVC(ctx, &sandbox); err != nil {
		return r.fail(ctx, &sandbox, err)
	}

	if err := r.ensurePod(ctx, &sandbox); err != nil {
		return r.fail(ctx, &sandbox, err)
	}

	if err := r.ensureNetworkPolicy(ctx, &sandbox); err != nil {
		return r.fail(ctx, &sandbox, err)
	}

	pod := &corev1.Pod{}
	if err := r.Get(ctx, client.ObjectKey{Namespace: sandbox.Namespace, Name: sandbox.Name}, pod); err != nil {
		if apierrors.IsNotFound(err) {
			return r.writeStatus(ctx, &sandbox, devinv1.SandboxPhaseProvisioning, "waiting for sandbox pod", "", pvcName(sandbox.Name))
		}
		return r.fail(ctx, &sandbox, err)
	}

	phase, message := phaseFromPod(pod)
	return r.writeStatus(ctx, &sandbox, phase, message, sandbox.Name, pvcName(sandbox.Name))
}

func (r *SandboxReconciler) ensurePVC(ctx context.Context, sandbox *devinv1.Sandbox) error {
	pvc := workspacePVC(sandbox, r.Config)
	if err := controllerutil.SetControllerReference(sandbox, pvc, r.Scheme); err != nil {
		return err
	}

	existing := &corev1.PersistentVolumeClaim{}
	err := r.Get(ctx, client.ObjectKeyFromObject(pvc), existing)
	if apierrors.IsNotFound(err) {
		return r.Create(ctx, pvc)
	}
	if err != nil {
		return err
	}
	return nil
}

func (r *SandboxReconciler) ensurePod(ctx context.Context, sandbox *devinv1.Sandbox) error {
	pod := sandboxPod(sandbox, r.Config)
	if err := controllerutil.SetControllerReference(sandbox, pod, r.Scheme); err != nil {
		return err
	}

	existing := &corev1.Pod{}
	err := r.Get(ctx, client.ObjectKeyFromObject(pod), existing)
	if apierrors.IsNotFound(err) {
		return r.Create(ctx, pod)
	}
	if err != nil {
		return err
	}
	return nil
}

func (r *SandboxReconciler) ensureNetworkPolicy(ctx context.Context, sandbox *devinv1.Sandbox) error {
	policy := sandboxNetworkPolicy(sandbox, r.Config)
	if err := controllerutil.SetControllerReference(sandbox, policy, r.Scheme); err != nil {
		return err
	}

	existing := &networkingv1.NetworkPolicy{}
	err := r.Get(ctx, client.ObjectKeyFromObject(policy), existing)
	if apierrors.IsNotFound(err) {
		return r.Create(ctx, policy)
	}
	if err != nil {
		return err
	}
	return nil
}

func (r *SandboxReconciler) finalize(ctx context.Context, sandbox *devinv1.Sandbox) (ctrl.Result, error) {
	if controllerutil.ContainsFinalizer(sandbox, sandboxFinalizer) {
		_, _ = r.writeStatus(ctx, sandbox, devinv1.SandboxPhaseTerminating, "cleaning up sandbox resources", "", "")

		objects := []client.Object{
			&corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: sandbox.Name, Namespace: sandbox.Namespace}},
			&corev1.PersistentVolumeClaim{ObjectMeta: metav1.ObjectMeta{Name: pvcName(sandbox.Name), Namespace: sandbox.Namespace}},
			&networkingv1.NetworkPolicy{ObjectMeta: metav1.ObjectMeta{Name: networkPolicyName(sandbox.Name), Namespace: sandbox.Namespace}},
		}

		for _, obj := range objects {
			if err := r.Delete(ctx, obj); err != nil && !apierrors.IsNotFound(err) {
				return ctrl.Result{RequeueAfter: 5 * time.Second}, err
			}
		}

		controllerutil.RemoveFinalizer(sandbox, sandboxFinalizer)
		if err := r.Update(ctx, sandbox); err != nil {
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

func (r *SandboxReconciler) fail(ctx context.Context, sandbox *devinv1.Sandbox, err error) (ctrl.Result, error) {
	_, _ = r.writeStatus(ctx, sandbox, devinv1.SandboxPhaseFailed, err.Error(), "", pvcName(sandbox.Name))
	return ctrl.Result{RequeueAfter: 30 * time.Second}, err
}

func (r *SandboxReconciler) writeStatus(
	ctx context.Context,
	sandbox *devinv1.Sandbox,
	phase devinv1.SandboxPhase,
	message string,
	podName string,
	pvc string,
) (ctrl.Result, error) {
	latest := &devinv1.Sandbox{}
	if err := r.Get(ctx, client.ObjectKeyFromObject(sandbox), latest); err != nil {
		return ctrl.Result{}, err
	}

	latest.Status.Phase = phase
	latest.Status.Message = message
	latest.Status.PodName = podName
	latest.Status.PVCName = pvc

	if err := r.Status().Update(ctx, latest); err != nil {
		return ctrl.Result{}, err
	}

	if phase == devinv1.SandboxPhasePending || phase == devinv1.SandboxPhaseProvisioning {
		return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
	}

	return ctrl.Result{}, nil
}

func phaseFromPod(pod *corev1.Pod) (devinv1.SandboxPhase, string) {
	switch pod.Status.Phase {
	case corev1.PodRunning:
		return devinv1.SandboxPhaseRunning, "sandbox pod is running"
	case corev1.PodPending:
		return devinv1.SandboxPhaseProvisioning, "sandbox pod is pending"
	case corev1.PodFailed:
		return devinv1.SandboxPhaseFailed, "sandbox pod failed"
	case corev1.PodSucceeded:
		return devinv1.SandboxPhaseTerminated, "sandbox pod completed"
	default:
		return devinv1.SandboxPhaseProvisioning, fmt.Sprintf("sandbox pod phase %s", pod.Status.Phase)
	}
}

func (r *SandboxReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&devinv1.Sandbox{}).
		Owns(&corev1.Pod{}).
		Owns(&corev1.PersistentVolumeClaim{}).
		Owns(&networkingv1.NetworkPolicy{}).
		Complete(r)
}
