variable "project" {
  type    = string
  default = "nextjs-shop"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "region" {
  type    = string
  default = "eu-north-1" # PLACEHOLDER
}

variable "github_repo" {
  type        = string
  description = "OWNER/REPO allowed to deploy the app (assumes the deploy role)."
  default     = "REPLACE_OWNER/nextjs-shop" # PLACEHOLDER
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "cpu" {
  type        = number
  description = "Fargate task CPU units (256 = 0.25 vCPU)."
  default     = 512
}

variable "memory" {
  type        = number
  description = "Fargate task memory in MiB."
  default     = 1024
}

variable "desired_count" {
  type        = number
  description = <<-EOT
    Number of tasks. Keep at 1 while the shop uses the in-memory db, per-process ISR cache
    and per-process rate limiter (src/lib/db.ts, rate-limit.ts). Raise only after moving
    those to Postgres/Redis and adding a shared Next.js cache handler.
  EOT
  default     = 1
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS. Empty = HTTP only (starter / no domain yet)."
  default     = ""
}

variable "bootstrap_image_tag" {
  type        = string
  description = "Image tag used only for the very first task definition; CI deploys real tags afterwards."
  default     = "bootstrap"
}
