# Runtime secrets live in Secrets Manager and are injected into the container by ECS.
# Terraform creates the secret but NOT its value (so the value never lands in state or git).
# Set it once:
#   aws secretsmanager put-secret-value --secret-id nextjs-shop/production/revalidate-secret \
#     --secret-string "$(openssl rand -hex 32)"

resource "aws_secretsmanager_secret" "revalidate" {
  name                    = "${var.project}/${var.environment}/revalidate-secret"
  description             = "x-webhook-secret for POST /api/revalidate (REVALIDATE_SECRET)"
  recovery_window_in_days = 7
}
