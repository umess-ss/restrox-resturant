resource "aws_lb" "main" {
  name               = "restrox-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = ["sg-069519baaef78f10f"]

  subnets = [
    "subnet-03978282da6bd61fe",
    "subnet-0b94aa31e9eeec639"
  ]
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "restrox-backend-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = "vpc-01b6010005fef05c8"
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 5
    unhealthy_threshold = 2
  }
  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}