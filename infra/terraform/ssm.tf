resource "aws_ssm_parameter" "mongo_uri" {
  name  = "/restrox/prod/MONGO_URI"
  type  = "SecureString"
  value = "PLACEHOLDER_DO_NOT_USE"

  lifecycle {
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