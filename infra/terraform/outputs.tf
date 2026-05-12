output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "vpc_id" {
  value = data.aws_vpc.existing.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "load_balancer_dns" {
  value = aws_lb.main.dns_name
}

output "target_group_arn" {
  value = aws_lb_target_group.backend.arn
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}