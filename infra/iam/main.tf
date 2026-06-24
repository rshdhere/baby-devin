resource "aws_iam_user" "devin_infra" {
  name = var.user_name

  tags = merge(var.tags, {
    Project   = "devin"
    ManagedBy = "terraform"
  })

  lifecycle {
    # Imported users may lack tags; avoid requiring iam:TagUser on re-apply.
    ignore_changes = [tags, tags_all]
  }
}

resource "aws_iam_policy" "terraform" {
  name   = var.policy_name
  policy = file("${path.module}/devin-infra-policy.json")

  lifecycle {
    # Adding description to an imported policy forces destroy/create; update
    # policy content via create-policy-version (GitHub Action), not replacement.
    prevent_destroy = true
  }
}

resource "aws_iam_user_policy_attachment" "devin_infra" {
  user       = aws_iam_user.devin_infra.name
  policy_arn = aws_iam_policy.terraform.arn
}
