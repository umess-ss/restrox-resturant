resource "aws_security_group" "alb" {
  name        = "restrox-alb-sg"
  description = "Security group for public load balancer"
  vpc_id      = "vpc-01b6010005fef05c8"
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_security_group" "ecs" {
  name        = "restrox-ecs-sg"
  description = "Security group for ECS backend task"
  vpc_id      = "vpc-01b6010005fef05c8"
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}