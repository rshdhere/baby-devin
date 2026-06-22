output "vpc_id" {
  description = "VPC identifier."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "internet_gateway_id" {
  description = "Internet gateway ID attached to the VPC."
  value       = aws_internet_gateway.this.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (NAT, internet-facing load balancers)."
  value       = aws_subnet.public[*].id
}

output "public_route_table_id" {
  description = "Route table for public subnets (default route → internet gateway)."
  value       = aws_route_table.public.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (EKS nodes, execution hosts)."
  value       = aws_subnet.private[*].id
}

output "private_route_table_ids" {
  description = "Route tables for private subnets (default route → NAT when enabled)."
  value       = aws_route_table.private[*].id
}

output "nat_gateway_ids" {
  description = "NAT gateway IDs (empty when enable_nat_gateway is false)."
  value       = aws_nat_gateway.this[*].id
}

output "nat_gateway_public_ips" {
  description = "Elastic IPs attached to NAT gateways."
  value       = aws_eip.nat[*].public_ip
}

output "nat_gateway_enabled" {
  description = "Whether NAT gateway(s) are provisioned."
  value       = var.enable_nat_gateway
}
