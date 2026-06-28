resource "aws_sqs_queue" "tasks_dlq" {
  name                      = "${var.name_prefix}-tasks-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-tasks-dlq"
  })
}

resource "aws_sqs_queue" "tasks" {
  name                       = "${var.name_prefix}-tasks"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  receive_wait_time_seconds  = 20
  message_retention_seconds  = 345600 # 4 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tasks_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-tasks"
  })
}
