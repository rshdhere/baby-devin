package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	Group   = "devin.baby"
	Version = "v1"
)

var GroupVersion = schema.GroupVersion{Group: Group, Version: Version}

var (
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
	AddToScheme   = SchemeBuilder.AddToScheme
)

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(GroupVersion,
		&Sandbox{},
		&SandboxList{},
		&FirecrackerMachine{},
		&FirecrackerMachineList{},
		&FirecrackerHost{},
		&FirecrackerHostList{},
		&Snapshot{},
		&SnapshotList{},
	)
	metav1.AddToGroupVersion(scheme, GroupVersion)
	return nil
}
