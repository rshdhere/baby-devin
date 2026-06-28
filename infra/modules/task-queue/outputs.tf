output "queue_url" {
  description = "SQS queue URL for scheduler task jobs."
  value       = aws_sqs_queue.tasks.url
}

output "queue_arn" {
  description = "SQS queue ARN for IAM policies."
  value       = aws_sqs_queue.tasks.arn
}

output "dlq_arn" {
  description = "Dead-letter queue ARN."
  value       = aws_sqs_queue.tasks_dlq.arn
}
