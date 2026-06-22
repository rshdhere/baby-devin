variable "name" {
  description = "Name prefix for VPC resources."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread subnets across."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (EKS nodes, execution hosts)."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (NAT gateways, load balancers)."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Provision NAT gateway(s) so private subnets can reach the internet (Docker Hub, Neon, etc.)."
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway instead of one per AZ (lower cost for non-prod)."
  type        = bool
  default     = true
}

variable "cluster_name" {
  description = "EKS cluster name — used for subnet tags required by the AWS Load Balancer Controller."
  type        = string
}

variable "tags" {
  description = "Tags applied to all VPC resources."
  type        = map(string)
  default     = {}
}
