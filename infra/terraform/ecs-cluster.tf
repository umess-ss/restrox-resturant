resource "aws_ecs_cluster" "main" {
  name = "restrox-cluster"

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}