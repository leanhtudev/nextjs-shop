# Deploying the shop to AWS ECS Fargate with GitHub Actions

Everything ships through GitHub Actions. Terraform (in `infra/`) owns the infrastructure; the deploy workflow owns
the running image. All AWS values are **placeholders** and every AWS step is **skipped** until you switch it on
with a repository variable, so this can be merged before an AWS account is connected.

The pipeline itself (tests, CI, CD, rollback) is described in [PIPELINE.md](PIPELINE.md).

```
push to main
  ├─ infra/** changed ──> infra.yml: fmt → validate → Trivy config scan → plan (PR) / apply (main, "infra" env)
  └─ app changed ──────> cd.yml  : ci.yml gate → build + push image once (tag = git SHA)
                                    → approval ("production" env) → ECS rolling deploy → @smoke tests
                                    → auto rollback to the previous task definition if smoke fails

Internet → ALB (:80, :443 when a cert is set) → ECS service on Fargate (Next.js standalone, :3000)
                                                 ├─ image from ECR
                                                 ├─ logs → CloudWatch /ecs/nextjs-shop-production
                                                 └─ REVALIDATE_SECRET from Secrets Manager
```

## Is Kubernetes needed?

No. **ECS is the orchestrator** (schedules tasks, restarts them, rolls deploys, registers them with the ALB) and
**Fargate is the serverless compute** under it. EKS would replace ECS, not complement it; it is worth it only for
many services, multi-cloud, or an existing Kubernetes platform team.

## What was missing, and where it is now

| Piece | Why it is needed | Where |
| --- | --- | --- |
| `output: "standalone"` + `deploymentId` | Small runnable server for the image; version-skew protection on rolling deploys | `next.config.ts` |
| Health endpoint | ALB target group + container health check | `src/app/api/health/route.ts` (+ Jest test) |
| Dockerfile | Multi-stage build, non-root user, Server Actions key as a build secret | `Dockerfile`, `.dockerignore` |
| Remote state + GitHub OIDC | Terraform state shared by CI; no long-lived AWS keys | `infra/bootstrap/` (run once) |
| VPC, subnets, security groups | Network for ALB and tasks | `infra/network.tf` |
| ALB + target group | Public entry point, health checks, HTTPS when a cert exists | `infra/alb.tf` |
| ECR repository | Stores images (immutable SHA tags, scan on push, keeps last 30) | `infra/ecr.tf` |
| ECS cluster, task definition, service | Runs the container on Fargate, circuit breaker rollback | `infra/ecs.tf` |
| IAM roles | Execution role (pull image, logs, secrets), task role (app), build role (CI → ECR), deploy role (CI → ECS) | `infra/ecs.tf`, `infra/github-deploy-role.tf` |
| Secrets | `REVALIDATE_SECRET` injected at runtime, value never in git/state | `infra/secrets.tf` |
| CI/CD workflows | Test gate, build once, gated deploy, smoke + auto rollback, manual rollback, infra plan/apply | `.github/workflows/`, see [PIPELINE.md](PIPELINE.md) |

## Placeholders to replace

| Placeholder | File | Replace with |
| --- | --- | --- |
| `eu-north-1` | `infra/variables.tf`, `infra/bootstrap/main.tf` | Your AWS region |
| `REPLACE_OWNER/nextjs-shop` | `infra/bootstrap/main.tf` (CI passes `github.repository` for the main stack) | Your `owner/repo` |
| `replace-me-nextjs-shop-tfstate` | `infra/bootstrap/main.tf`, `infra/backend.hcl.example` | A globally unique bucket name |
| `certificate_arn = ""` | `infra/terraform.tfvars.example` / GitHub var `CERTIFICATE_ARN` | ACM cert ARN once you have a domain |

## GitHub configuration

Settings → Secrets and variables → Actions, plus two **environments** (Settings → Environments).

| Name | Kind | Value (source) |
| --- | --- | --- |
| `AWS_INFRA_ENABLED` | variable | `true` to run plan/apply (leave unset until AWS is ready) |
| `AWS_DEPLOY_ENABLED` | variable | `true` to run the deploy job |
| `AWS_REGION` | variable | e.g. `eu-north-1` |
| `TF_STATE_BUCKET` | variable | bootstrap output `state_bucket` |
| `AWS_INFRA_ROLE_ARN` | variable | bootstrap output `github_infra_role_arn` |
| `AWS_BUILD_ROLE_ARN` | variable | infra output `github_build_role_arn` (ECR push, main only) |
| `AWS_DEPLOY_ROLE_ARN` | variable | infra output `github_deploy_role_arn` (ECS rollout, `production` env only) |
| `ECR_REPOSITORY` | variable | infra output `ecr_repository` |
| `ECS_CLUSTER` | variable | infra output `ecs_cluster` |
| `ECS_SERVICE` | variable | infra output `ecs_service` |
| `ECS_TASK_FAMILY` | variable | infra output `ecs_task_family` |
| `APP_URL` | variable | infra output `app_url` (enables the smoke test) |
| `CERTIFICATE_ARN` | variable | optional, ACM cert for HTTPS |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | secret | `openssl rand -base64 32` (same value forever) |
| `infra` | environment | Required reviewers; deployment branch `main` |
| `production` | environment | Required reviewers (optional); deployment branch `main` |

## First-time setup (in order)

1. **Bootstrap (once, from a laptop with admin credentials):**
   `cd infra/bootstrap && terraform init && terraform apply -var github_repo=OWNER/REPO -var state_bucket=UNIQUE-NAME`
2. Set `AWS_REGION`, `TF_STATE_BUCKET`, `AWS_INFRA_ROLE_ARN`, then `AWS_INFRA_ENABLED=true`. Create the `infra` environment.
3. **Infra via Actions:** run "Infrastructure (Terraform)" (workflow_dispatch or merge an `infra/` change). Approve the
   `infra` environment. Copy the outputs from the job summary into the GitHub variables above.
   The service starts with a `bootstrap` image tag that doesn't exist yet; its first task fails until step 5. That is expected.
4. Set the runtime secret once:
   `aws secretsmanager put-secret-value --secret-id nextjs-shop/production/revalidate-secret --secret-string "$(openssl rand -hex 32)"`
5. Add `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, create the `production` environment, set `AWS_DEPLOY_ENABLED=true`, then
   push to `main` (or run "CD" manually). The first real image goes out and the service turns healthy.
6. Open `APP_URL`. `/api/health` shows the deployed git SHA.

## Rollback

- **Automatic, infrastructure level:** the ECS deployment circuit breaker rolls back if new tasks fail to start or stay
  unhealthy.
- **Automatic, application level:** if the post-deploy `@smoke` tests fail, `cd.yml` points the service back at the task
  definition that was running before the deploy.
- **Manual:** run the "Rollback" workflow. Leave the revision empty to list recent revisions and their image SHAs, then run
  it again with the revision number. It uses the same approval gate and role as a deploy.

## Known limits of this starter (before going multi-task)

- **`desired_count = 1` on purpose.** The shop keeps its db, ISR cache and rate limiter in process memory
  (`src/lib/db.ts`, `src/lib/rate-limit.ts`). Two tasks would show different stock and orders. To scale out:
  Postgres (RDS) for data, Redis (ElastiCache) for the rate limiter, and a shared Next.js `cacheHandler`.
- Data resets on every deploy/restart (in-memory db).
- Tasks run in public subnets with a public IP (no NAT gateway cost). Production: private subnets + NAT or VPC endpoints.
- No domain/HTTPS until `CERTIFICATE_ARN` is set (then `COOKIE_SECURE=1` is switched on automatically).
- The bootstrap infra role uses `AdministratorAccess` for simplicity. Replace with a scoped policy.
- No autoscaling, WAF or CloudFront yet. CloudFront in front of the ALB is the next step for `/_next/static` caching.
