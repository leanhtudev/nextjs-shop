terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }

  # Values come from backend.hcl (see backend.hcl.example), so no account details live here:
  #   terraform init -backend-config=backend.hcl
  # CI writes backend.hcl from GitHub variables.
  backend "s3" {}
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
