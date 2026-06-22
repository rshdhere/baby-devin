variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version (must be 1.28+ per deployment.md)."
  type        = string
  default     = "1.29"
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the EKS control plane and node groups."
  type        = list(string)
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group (control-plane workloads only)."
  type        = list(string)
  default     = ["m6i.large"]
}

variable "node_desired_size" {
  description = "Desired number of EKS worker nodes."
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of EKS worker nodes."
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of EKS worker nodes."
  type        = number
  default     = 4
}

variable "node_disk_size" {
  description = "Root volume size (GiB) for EKS worker nodes."
  type        = number
  default     = 50
}

variable "endpoint_public_access" {
  description = "Allow the Kubernetes API server to be reachable from the public internet."
  type        = bool
  default     = true
}

variable "endpoint_public_access_cidrs" {
  description = "CIDR blocks allowed to reach the public Kubernetes API endpoint."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vpc_cidr_block" {
  description = "VPC CIDR — used for security group egress to execution hosts."
  type        = string
}

variable "tags" {
  description = "Tags applied to EKS resources."
  type        = map(string)
  default     = {}
}
