resource "aws_ecr_repository" "backend" {
  name         = "restrox-backend"
  force_delete = true

  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = "arn:aws:kms:us-east-1:348362971250:key/af965a8f-7c15-404b-8e5f-39e79d308c5a"
  }

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = {
    Project     = "restrox"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}