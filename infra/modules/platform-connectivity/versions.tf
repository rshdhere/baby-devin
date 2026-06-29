terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
    time = {
      source = "hashicorp/time"
    }
    null = {
      source = "hashicorp/null"
    }
    local = {
      source = "hashicorp/local"
    }
  }
}
