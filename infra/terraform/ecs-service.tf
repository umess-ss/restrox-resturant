resource "aws_ecs_service" "backend" {
  name            = "restrox-backend-task-service-3uw8ss0v"
  cluster         = aws_ecs_cluster.main.id
  task_definition = "arn:aws:ecs:us-east-1:348362971250:task-definition/restrox-backend-task:5"
  desired_count   = 1
  launch_type     = "FARGATE"

  platform_version = "LATEST"

  enable_ecs_managed_tags = true
  wait_for_steady_state   = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets = [
      "subnet-03978282da6bd61fe",
      "subnet-0b94aa31e9eeec639"
    ]

    security_groups = [
      aws_security_group.ecs.id
    ]

    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "restrox-backend"
    container_port   = 5000
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [
      task_definition
    ]
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}