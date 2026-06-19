package v1

import (
	"k8s.io/apimachinery/pkg/runtime"
)

func Register(scheme *runtime.Scheme) error {
	return AddToScheme(scheme)
}
