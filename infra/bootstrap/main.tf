# One-time bootstrap, applied ONCE by an admin from a laptop (local state is fine here).
# Creates what GitHub Actions needs before it can run the main stack:
#   1. S3 bucket for Terraform remote state (with native S3 locking)
#   2. GitHub OIDC identity provider (no long-lived AWS keys in GitHub)
#   3. IAM role that the "infra" workflow assumes to plan/apply ../ (main stack)
#
#   cd infra/bootstrap && terraform init && terraform apply \
#     -var github_repo="OWNER/REPO" -var state_bucket="REPLACE-ME-tfstate"

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "region" {
  type    = string
  default = "eu-north-1" # PLACEHOLDER: your AWS region
}

variable "github_repo" {
  type        = string
  description = "GitHub repository allowed to assume the role, as OWNER/REPO."
  default     = "REPLACE_OWNER/nextjs-shop" # PLACEHOLDER
}

variable "state_bucket" {
  type        = string
  description = "Globally unique S3 bucket name for Terraform state."
  default     = "replace-me-nextjs-shop-tfstate" # PLACEHOLDER
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = "nextjs-shop", ManagedBy = "terraform-bootstrap" } }
}

# ---------- Remote state bucket ----------
resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------- GitHub OIDC ----------
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Role for .github/workflows/infra.yml.
# - pull_request: terraform plan
# - environment "infra" (protected, main only): terraform apply
data "aws_iam_policy_document" "infra_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:pull_request",
        "repo:${var.github_repo}:environment:infra",
      ]
    }
  }
}

resource "aws_iam_role" "github_infra" {
  name               = "nextjs-shop-github-infra"
  assume_role_policy = data.aws_iam_policy_document.infra_trust.json
}

# Starter only: broad permissions so the main stack can create VPC, ECS, IAM, etc.
# Tighten to a custom policy (or a permissions boundary) before real use.
resource "aws_iam_role_policy_attachment" "github_infra_admin" {
  role       = aws_iam_role.github_infra.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "state_bucket" { value = aws_s3_bucket.state.bucket }
output "github_oidc_provider_arn" { value = aws_iam_openid_connect_provider.github.arn }
output "github_infra_role_arn" {
  description = "Set as GitHub variable AWS_INFRA_ROLE_ARN."
  value       = aws_iam_role.github_infra.arn
}
