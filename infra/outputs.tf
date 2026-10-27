output "app_url" {
  description = "Public URL of the shop (point a Route 53 alias here when you have a domain)."
  value       = "${local.https_enabled ? "https" : "http"}://${aws_lb.main.dns_name}"
}

# The values below map 1:1 to GitHub repository variables used by deploy.yml.
output "ecr_repository" {
  description = "GitHub variable ECR_REPOSITORY"
  value       = aws_ecr_repository.app.name
}

output "ecs_cluster" {
  description = "GitHub variable ECS_CLUSTER"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service" {
  description = "GitHub variable ECS_SERVICE"
  value       = aws_ecs_service.app.name
}

output "ecs_task_family" {
  description = "GitHub variable ECS_TASK_FAMILY"
  value       = aws_ecs_task_definition.app.family
}

output "github_build_role_arn" {
  description = "GitHub variable AWS_BUILD_ROLE_ARN (ECR push, main branch)"
  value       = aws_iam_role.github_build.arn
}

output "github_deploy_role_arn" {
  description = "GitHub variable AWS_DEPLOY_ROLE_ARN (ECS rollout, environment: production)"
  value       = aws_iam_role.github_deploy.arn
}

output "revalidate_secret_id" {
  value = aws_secretsmanager_secret.revalidate.name
}
