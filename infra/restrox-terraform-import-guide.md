# Restrox Terraform Import Documentation

## Project Context

This document explains how the existing AWS infrastructure for the **Restrox backend application** was brought under Terraform management safely.

The infrastructure was already created manually in AWS. Instead of recreating resources, the approach was to:

1. Inspect existing AWS resources.
2. Write matching Terraform resource blocks.
3. Import those existing resources into Terraform state.
4. Run `terraform plan` after every phase.
5. Apply only safe changes such as tags/default metadata.
6. Avoid destroying or replacing any production resource.

The main rule followed throughout the process was:

```txt
Never run terraform apply if the plan shows destroy or must be replaced.
```

---

## Current AWS Region and Project

```txt
AWS Region: us-east-1
AWS Account ID: 348362971250
Project Name: restrox
Environment: dev/prod resources imported from existing setup
```

---

## Existing AWS Resources Imported

The following existing AWS resources were imported into Terraform:

```txt
ECR Repository:
- restrox-backend

ECS:
- Cluster: restrox-cluster
- Service: restrox-backend-task-service-3uw8ss0v
- Task Definition Family: restrox-backend-task

Application Load Balancer:
- ALB: restrox-alb
- DNS: restrox-alb-2036076010.us-east-1.elb.amazonaws.com
- HTTP Listener: 80 -> redirect to HTTPS
- HTTPS Listener: 443 -> forward to target group

Target Group:
- restrox-backend-tg
- Port: 5000
- Protocol: HTTP
- Health check path: /api/health

Security Groups:
- restrox-alb-sg
- restrox-ecs-sg

SSM Parameters:
- /restrox/prod/MONGO_URI
- /restrox/prod/JWT_SECRET
- /restrox/prod/JWT_REFRESH_SECRET

CloudWatch:
- /ecs/restrox-backend-task

IAM:
- ecsTaskExecutionRole
- AmazonECSTaskExecutionRolePolicy attachment
- RestroxReadSSMSecretsPolicy inline policy
```

---

## Final Terraform State

The final `terraform state list` showed:

```txt
data.aws_caller_identity.current
data.aws_vpc.existing
aws_cloudwatch_log_group.backend
aws_ecr_repository.backend
aws_ecs_cluster.main
aws_ecs_service.backend
aws_iam_role.ecs_task_execution
aws_iam_role_policy.restrox_read_ssm_secrets
aws_iam_role_policy_attachment.ecs_task_execution_managed
aws_lb.main
aws_lb_listener.http_80
aws_lb_listener.https_443
aws_lb_target_group.backend
aws_security_group.alb
aws_security_group.ecs
aws_ssm_parameter.jwt_refresh_secret
aws_ssm_parameter.jwt_secret
aws_ssm_parameter.mongo_uri
```

---

# Phase 1: Terraform Base Setup

## Goal

Create a safe Terraform project structure and read existing AWS account/VPC information before importing resources.

## Files Created

```txt
infra/terraform/
├── versions.tf
├── provider.tf
├── variables.tf
├── main.tf
└── outputs.tf
```

## versions.tf

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
```

## provider.tf

```hcl
provider "aws" {
  region = var.aws_region
}
```

## variables.tf

```hcl
variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "restrox"
}

variable "environment" {
  type    = string
  default = "dev"
}
```

## main.tf Base Content

```hcl
data "aws_caller_identity" "current" {}

data "aws_vpc" "existing" {
  id = "vpc-01b6010005fef05c8"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

## Validation Commands

```bash
terraform init
terraform fmt
terraform validate
terraform plan
```

Expected result at this stage:

```txt
No infrastructure changes, only data reads or outputs.
```

---

# Phase 2: Import ECR Repository

## Goal

Import the existing ECR repository used to store the Docker image for the Restrox backend.

Existing ECR repository:

```txt
restrox-backend
```

## Step 1: Create `ecr.tf`

```hcl
resource "aws_ecr_repository" "backend" {
  name = "restrox-backend"

  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = "arn:aws:kms:us-east-1:348362971250:key/af965a8f-7c15-404b-8e5f-39e79d308c5a"
  }

  image_scanning_configuration {
    scan_on_push = false
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Step 2: Remove Duplicate ECR Data Source from `main.tf`

Removed:

```hcl
data "aws_ecr_repository" "backend" {
  name = "restrox-backend"
}
```

## Step 3: Update `outputs.tf`

Changed from:

```hcl
output "ecr_repository_url" {
  value = data.aws_ecr_repository.backend.repository_url
}
```

To:

```hcl
output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}
```

## Step 4: Import Existing ECR into Terraform State

```bash
terraform import aws_ecr_repository.backend restrox-backend
```

## Step 5: Verify

```bash
terraform fmt
terraform validate
terraform plan
```

During this phase Terraform first showed replacement because the existing ECR used KMS encryption. The fix was to add the existing KMS encryption configuration to `ecr.tf`.

Safe result:

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

Only tags were updated.

---

# Phase 3: Import ECS Cluster

## Goal

Import the existing ECS cluster.

Existing ECS cluster:

```txt
restrox-cluster
```

## Create `ecs-cluster.tf`

```hcl
resource "aws_ecs_cluster" "main" {
  name = "restrox-cluster"

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Remove ECS Cluster Data Source from `main.tf`

Removed:

```hcl
data "aws_ecs_cluster" "main" {
  cluster_name = "restrox-cluster"
}
```

## Update `outputs.tf`

Changed from:

```hcl
output "ecs_cluster_arn" {
  value = data.aws_ecs_cluster.main.arn
}
```

To:

```hcl
output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}
```

## Import ECS Cluster

```bash
terraform import aws_ecs_cluster.main restrox-cluster
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

Only tag/default configuration differences were handled.

---

# Phase 4: Import ALB and Target Group

## Goal

Import the Application Load Balancer and target group used by ECS.

Existing resources:

```txt
ALB: restrox-alb
Target Group: restrox-backend-tg
```

## ALB Details

```txt
ALB ARN:
arn:aws:elasticloadbalancing:us-east-1:348362971250:loadbalancer/app/restrox-alb/3a5423a5f1e85056

Subnets:
- subnet-03978282da6bd61fe
- subnet-0b94aa31e9eeec639

Security Group:
- sg-069519baaef78f10f
```

## Target Group Details

```txt
Target Group ARN:
arn:aws:elasticloadbalancing:us-east-1:348362971250:targetgroup/restrox-backend-tg/03fbf37dd977182a

Port: 5000
Protocol: HTTP
VPC: vpc-01b6010005fef05c8
Target Type: ip
Health Check: /api/health
```

## Create `alb.tf`

```hcl
resource "aws_lb" "main" {
  name               = "restrox-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = ["sg-069519baaef78f10f"]

  subnets = [
    "subnet-03978282da6bd61fe",
    "subnet-0b94aa31e9eeec639"
  ]

  lifecycle {
    prevent_destroy = true
  }

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

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Remove ALB Data Sources from `main.tf`

Removed:

```hcl
data "aws_lb" "main" {
  name = "restrox-alb"
}

data "aws_lb_target_group" "backend" {
  name = "restrox-backend-tg"
}
```

## Update `outputs.tf`

Changed from data sources to managed resources:

```hcl
output "load_balancer_dns" {
  value = aws_lb.main.dns_name
}

output "target_group_arn" {
  value = aws_lb_target_group.backend.arn
}
```

## Import ALB

```bash
terraform import aws_lb.main 'arn:aws:elasticloadbalancing:us-east-1:348362971250:loadbalancer/app/restrox-alb/3a5423a5f1e85056'
```

## Import Target Group

```bash
terraform import aws_lb_target_group.backend 'arn:aws:elasticloadbalancing:us-east-1:348362971250:targetgroup/restrox-backend-tg/03fbf37dd977182a'
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 2 to change, 0 to destroy
```

Only tags/default attributes were applied.

---

# Phase 5: Import Security Groups

## Goal

Import the ALB and ECS security groups.

Existing security groups:

```txt
ALB Security Group:
- restrox-alb-sg
- sg-069519baaef78f10f

ECS Security Group:
- restrox-ecs-sg
- sg-0a7bf2c95a7cf129c
```

## Create `security-groups.tf`

```hcl
resource "aws_security_group" "alb" {
  name        = "restrox-alb-sg"
  description = "Security group for public load balancer"
  vpc_id      = "vpc-01b6010005fef05c8"

  lifecycle {
    prevent_destroy = true
  }

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

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Remove Security Group Data Sources from `main.tf`

Removed:

```hcl
data "aws_security_group" "alb" {
  id = "sg-069519baaef78f10f"
}

data "aws_security_group" "ecs" {
  id = "sg-0a7bf2c95a7cf129c"
}
```

## Update `outputs.tf`

```hcl
output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}
```

## Import Security Groups

```bash
terraform import aws_security_group.alb sg-069519baaef78f10f
```

```bash
terraform import aws_security_group.ecs sg-0a7bf2c95a7cf129c
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 2 to change, 0 to destroy
```

Only tags/default attributes were updated.

---

# Phase 6: Import SSM Parameters

## Goal

Import secure application configuration stored in AWS Systems Manager Parameter Store.

Existing parameters:

```txt
/restrox/prod/MONGO_URI
/restrox/prod/JWT_SECRET
/restrox/prod/JWT_REFRESH_SECRET
```

## Important Security Note

The real secret values should not be written into Terraform code.

To avoid overwriting real secrets, each SSM parameter resource used:

```hcl
value = "PLACEHOLDER_DO_NOT_USE"

lifecycle {
  ignore_changes = [value]
}
```

This allows Terraform to manage the parameter metadata/tags while ignoring the actual secret value.

## Create `ssm.tf`

```hcl
resource "aws_ssm_parameter" "mongo_uri" {
  name  = "/restrox/prod/MONGO_URI"
  type  = "SecureString"
  value = "PLACEHOLDER_DO_NOT_USE"

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      value
    ]
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/restrox/prod/JWT_SECRET"
  type  = "SecureString"
  value = "PLACEHOLDER_DO_NOT_USE"

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      value
    ]
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "/restrox/prod/JWT_REFRESH_SECRET"
  type  = "SecureString"
  value = "PLACEHOLDER_DO_NOT_USE"

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      value
    ]
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Remove SSM Data Sources from `main.tf`

Removed:

```hcl
data "aws_ssm_parameter" "mongo_uri" {
  name            = "/restrox/prod/MONGO_URI"
  with_decryption = false
}

data "aws_ssm_parameter" "jwt_secret" {
  name            = "/restrox/prod/JWT_SECRET"
  with_decryption = false
}

data "aws_ssm_parameter" "jwt_refresh_secret" {
  name            = "/restrox/prod/JWT_REFRESH_SECRET"
  with_decryption = false
}
```

## Import SSM Parameters

```bash
terraform import aws_ssm_parameter.mongo_uri /restrox/prod/MONGO_URI
```

```bash
terraform import aws_ssm_parameter.jwt_secret /restrox/prod/JWT_SECRET
```

```bash
terraform import aws_ssm_parameter.jwt_refresh_secret /restrox/prod/JWT_REFRESH_SECRET
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Before applying, the plan was checked to ensure Terraform was not trying to apply:

```txt
value = "PLACEHOLDER_DO_NOT_USE"
```

Safe result:

```txt
Plan: 0 to add, 3 to change, 0 to destroy
```

Only tags/default metadata were updated.

---

# Phase 7: Import ALB Listeners

## Goal

Import ALB listeners for HTTP and HTTPS.

Existing listeners:

```txt
HTTP 80  -> redirect to HTTPS 443
HTTPS 443 -> forward to restrox-backend-tg
```

## Listener Details

```txt
HTTP Listener ARN:
arn:aws:elasticloadbalancing:us-east-1:348362971250:listener/app/restrox-alb/3a5423a5f1e85056/18c8d942f348a431

HTTPS Listener ARN:
arn:aws:elasticloadbalancing:us-east-1:348362971250:listener/app/restrox-alb/3a5423a5f1e85056/ac4b397a608b547a

Certificate ARN:
arn:aws:acm:us-east-1:348362971250:certificate/5f8d7a9c-033d-4e66-8f2e-5b72f7ce4cc3

SSL Policy:
ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09
```

## Create `listeners.tf`

```hcl
resource "aws_lb_listener" "http_80" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = "443"
      host        = "#{host}"
      path        = "/#{path}"
      query       = "#{query}"
      status_code = "HTTP_301"
    }
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

resource "aws_lb_listener" "https_443" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09"
  certificate_arn   = "arn:aws:acm:us-east-1:348362971250:certificate/5f8d7a9c-033d-4e66-8f2e-5b72f7ce4cc3"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Import HTTP Listener

```bash
terraform import aws_lb_listener.http_80 'arn:aws:elasticloadbalancing:us-east-1:348362971250:listener/app/restrox-alb/3a5423a5f1e85056/18c8d942f348a431'
```

## Import HTTPS Listener

```bash
terraform import aws_lb_listener.https_443 'arn:aws:elasticloadbalancing:us-east-1:348362971250:listener/app/restrox-alb/3a5423a5f1e85056/ac4b397a608b547a'
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 2 to change, 0 to destroy
```

Terraform normalized the listener forwarding structure but did not destroy or replace the listeners.

---

# Phase 8: ECS Task Definition and ECS Service

## Goal

Bring the ECS service under Terraform management while avoiding conflict with GitHub Actions CI/CD.

## Step 1: Get ECS Service Details

```bash
aws ecs describe-services \
  --cluster restrox-cluster \
  --services restrox-backend-task-service-3uw8ss0v \
  --region us-east-1 \
  --query "services[0].{ServiceName:serviceName,TaskDefinition:taskDefinition,DesiredCount:desiredCount,LaunchType:launchType,PlatformVersion:platformVersion,Subnets:networkConfiguration.awsvpcConfiguration.subnets,SecurityGroups:networkConfiguration.awsvpcConfiguration.securityGroups,AssignPublicIp:networkConfiguration.awsvpcConfiguration.assignPublicIp,TargetGroupArn:loadBalancers[0].targetGroupArn,ContainerName:loadBalancers[0].containerName,ContainerPort:loadBalancers[0].containerPort}" \
  --output json
```

Result:

```json
{
  "ServiceName": "restrox-backend-task-service-3uw8ss0v",
  "TaskDefinition": "arn:aws:ecs:us-east-1:348362971250:task-definition/restrox-backend-task:5",
  "DesiredCount": 1,
  "LaunchType": "FARGATE",
  "PlatformVersion": "LATEST",
  "Subnets": [
    "subnet-03978282da6bd61fe",
    "subnet-0b94aa31e9eeec639"
  ],
  "SecurityGroups": [
    "sg-0a7bf2c95a7cf129c"
  ],
  "AssignPublicIp": "ENABLED",
  "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:348362971250:targetgroup/restrox-backend-tg/03fbf37dd977182a",
  "ContainerName": "restrox-backend",
  "ContainerPort": 5000
}
```

## Step 2: Get Task Definition Details

```bash
aws ecs describe-task-definition \
  --task-definition restrox-backend-task \
  --region us-east-1 \
  --query "taskDefinition.{Family:family,Revision:revision,Cpu:cpu,Memory:memory,NetworkMode:networkMode,RequiresCompatibilities:requiresCompatibilities,ExecutionRoleArn:executionRoleArn,TaskRoleArn:taskRoleArn,ContainerDefinitions:containerDefinitions}" \
  --output json
```

Important task definition details:

```txt
Family: restrox-backend-task
Revision: 5
CPU: 256
Memory: 512
Network Mode: awsvpc
Compatibility: FARGATE
Execution Role: ecsTaskExecutionRole
Container Name: restrox-backend
Container Port: 5000
Image: ECR image with GitHub Actions commit SHA tag
```

## Important CI/CD Decision

Terraform should not fully manage the task definition image tag because GitHub Actions updates it during deployment.

Therefore:

```txt
Terraform manages ECS Service.
GitHub Actions manages new image/task definition revisions.
Terraform ignores task_definition drift.
```

This prevents Terraform from rolling the ECS service back to an older task definition revision.

---

# Phase 8 Continued: Import ECS Service Safely

## Create `ecs-service.tf`

```hcl
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
    prevent_destroy = true

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
```

## Import ECS Service

```bash
terraform import aws_ecs_service.backend restrox-cluster/restrox-backend-task-service-3uw8ss0v
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

The service was adjusted to match existing settings:

```txt
enable_ecs_managed_tags = true
deployment_circuit_breaker enable = true
deployment_circuit_breaker rollback = true
```

---

# Phase 9: Import CloudWatch Log Group

## Goal

Import the CloudWatch log group used by the ECS task.

Existing log group:

```txt
/ecs/restrox-backend-task
```

## Check Log Group

```bash
aws logs describe-log-groups \
  --log-group-name-prefix "/ecs/restrox-backend-task" \
  --region us-east-1 \
  --query "logGroups[*].[logGroupName,retentionInDays,storedBytes]" \
  --output table
```

Result:

```txt
/ecs/restrox-backend-task | None | 879139
```

`None` means no log retention limit was configured.

## Create `cloudwatch.tf`

```hcl
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/restrox-backend-task"
  retention_in_days = 0

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Import Log Group

```bash
terraform import aws_cloudwatch_log_group.backend /ecs/restrox-backend-task
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

Only tags/default metadata were applied.

---

# Phase 10: Import IAM Role Used by ECS

## Goal

Import the IAM execution role used by ECS tasks.

Existing role:

```txt
ecsTaskExecutionRole
```

This role allows ECS to:

```txt
- Pull images from ECR
- Write logs to CloudWatch
- Read secrets from SSM Parameter Store
```

## Step 1: Inspect Current Role

```bash
aws iam get-role \
  --role-name ecsTaskExecutionRole \
  --query "Role.{RoleName:RoleName,Arn:Arn,AssumeRolePolicyDocument:AssumeRolePolicyDocument}" \
  --output json
```

Result:

```json
{
  "RoleName": "ecsTaskExecutionRole",
  "Arn": "arn:aws:iam::348362971250:role/ecsTaskExecutionRole",
  "AssumeRolePolicyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
}
```

## Check Attached Managed Policies

```bash
aws iam list-attached-role-policies \
  --role-name ecsTaskExecutionRole \
  --output table
```

Result:

```txt
arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

## Check Inline Policies

```bash
aws iam list-role-policies \
  --role-name ecsTaskExecutionRole \
  --output table
```

Result:

```txt
RestroxReadSSMSecretsPolicy
```

## Inspect Inline Policy

```bash
aws iam get-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name RestroxReadSSMSecretsPolicy \
  --query "PolicyDocument" \
  --output json
```

Result:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": [
        "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/MONGO_URI",
        "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/JWT_SECRET",
        "arn:aws:ssm:us-east-1:348362971250:parameter/restrox/prod/JWT_REFRESH_SECRET"
      ]
    }
  ]
}
```

## Create `iam.tf`

```hcl
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
```

## Import IAM Role

```bash
terraform import aws_iam_role.ecs_task_execution ecsTaskExecutionRole
```

## Import Managed Policy Attachment

```bash
terraform import aws_iam_role_policy_attachment.ecs_task_execution_managed 'ecsTaskExecutionRole/arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
```

## Import Inline Policy

```bash
terraform import aws_iam_role_policy.restrox_read_ssm_secrets ecsTaskExecutionRole:RestroxReadSSMSecretsPolicy
```

## Verify

```bash
terraform fmt
terraform validate
terraform plan
```

Safe result:

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

Only tags/default metadata were applied.

---

# Verification Checklist

After every phase, the same verification pattern was used:

```bash
terraform fmt
terraform validate
terraform plan
```

A plan was considered safe only when it showed:

```txt
0 to destroy
```

Safe examples:

```txt
Plan: 0 to add, 0 to change, 0 to destroy
```

```txt
Plan: 0 to add, 1 to change, 0 to destroy
```

Unsafe examples:

```txt
must be replaced
```

```txt
Plan: 1 to add, 0 to change, 1 to destroy
```

```txt
Plan: 0 to add, 0 to change, 1 to destroy
```

For unsafe plans, the Terraform code was updated to match the existing AWS configuration instead of applying destructive changes.

---

# Phase 11: Backup Terraform State

## Goal

Create a local backup of Terraform state after successful imports.

## Commands

```bash
mkdir -p backups
cp terraform.tfstate backups/terraform.tfstate.$(date +%F-%H-%M-%S).backup
terraform state list > backups/terraform-state-list.$(date +%F-%H-%M-%S).txt
```

## Important Note

Terraform state files must not be committed to GitHub because they may contain sensitive infrastructure metadata.

---

# Update `.gitignore`

The project `.gitignore` was updated to exclude Terraform local files, state files, backups, and variable files.

```gitignore
# Terraform
**/.terraform/
**/.terraform.lock.hcl
**/terraform.tfstate
**/terraform.tfstate.backup
**/*.tfstate
**/*.tfstate.*
**/crash.log
**/crash.*.log
**/*.tfvars

# Terraform local backups
**/backups/
```

---

# Git Commit

Only safe Terraform code files should be committed.

## Safe to Commit

```txt
infra/terraform/*.tf
.gitignore
```

## Do Not Commit

```txt
terraform.tfstate
terraform.tfstate.backup
*.tfstate
*.tfvars
.terraform/
backups/
```

## Commit Command

```bash
git add infra/terraform/*.tf .gitignore
git commit -m "chore: import existing AWS infrastructure into Terraform"
git push
```

---

# Final Result

The existing Restrox AWS backend infrastructure was successfully imported into Terraform without destroying or recreating resources.

Terraform now manages:

```txt
✅ ECR Repository
✅ ECS Cluster
✅ ECS Service
✅ Application Load Balancer
✅ HTTP Listener
✅ HTTPS Listener
✅ Target Group
✅ Security Groups
✅ SSM Secure Parameters
✅ CloudWatch Log Group
✅ IAM Execution Role
✅ IAM Managed Policy Attachment
✅ IAM Inline SSM Policy
```

GitHub Actions still manages:

```txt
✅ Docker image build
✅ ECR image push
✅ ECS task definition revision update
✅ ECS service deployment
```

Terraform intentionally ignores ECS `task_definition` drift to avoid conflict with CI/CD.

---

# Future Improvements

Possible next steps:

```txt
1. Import ACM certificate.
2. Import Route 53 DNS records.
3. Convert hardcoded values into variables.
4. Split Terraform into modules.
5. Add remote backend using S3 + DynamoDB state locking.
6. Add separate dev/prod workspaces or directories.
7. Fully manage task definition only if CI/CD is adjusted to work with Terraform.
```

---

# Key Lessons Learned

```txt
1. Importing existing infrastructure is safer than recreating it.
2. Always run terraform plan before apply.
3. Never apply when Terraform shows destroy or replacement unexpectedly.
4. Existing AWS defaults must be matched in Terraform code.
5. Terraform state must never be committed to GitHub.
6. Secrets should not be written directly into Terraform files.
7. CI/CD and Terraform responsibilities must be clearly separated.
8. lifecycle.prevent_destroy is useful during early import phases.
9. ignore_changes is useful when another system, such as GitHub Actions, manages part of a resource.
10. Incremental import is safer than importing many resources at once.
```
