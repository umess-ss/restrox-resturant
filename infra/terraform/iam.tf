resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "restrox_read_ssm_secrets" {
  name = "RestroxReadSSMSecretsPolicy"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/MONGO_URI",
          "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/JWT_SECRET",
          "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/JWT_REFRESH_SECRET"
        ]
      }
    ]
  })
}