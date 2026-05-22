resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/restrox-backend-task"
  retention_in_days = 0
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}