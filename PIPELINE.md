# CI/CD pipeline

Three layers of tests, one quality gate, one artifact per commit, and a gated, self-checking deploy.

```
Pull request ─────────────► ci.yml ── quality ──┐   lint (0 warnings) + typecheck
                                     ├ unit ─────┤   Jest + React Testing Library, coverage ratchet
                                     ├ e2e ──────┤   Playwright on the production build
                                     ├ docker ───┤   image build + Trivy scan + container health check
                                     └ dep-review┘   blocks new HIGH/CRITICAL dependencies
                                                 └► "CI passed"  (the one required status check)

Merge to main ────────────► cd.yml ── ci.yml (same gate again, on the merged code)
                                     └► build   : image built ONCE, tag = git SHA, pushed to ECR (build role)
                                        └► deploy: ⏸ approval ("production" env) → new task definition
                                                   → ECS rolling deploy → wait until stable
                                                   → @smoke tests against APP_URL (checks the SHA is live)
                                                   → ✗ smoke fails → automatic rollback to previous revision

Manual ───────────────────► rollback.yml: list recent revisions / roll back to revision N (same approval)
infra/** changes ─────────► infra.yml   : fmt → validate → Trivy config scan → plan (PR) / apply (main)
Weekly ───────────────────► Dependabot  : PRs for actions, npm, Docker base image, Terraform providers
```

## Test layers

| Layer | Tool | Where | What it proves | Runs in |
| --- | --- | --- | --- | --- |
| Unit | Jest | `__tests__/*.test.ts` | Pricing, schemas, rate limiter, db, tRPC routers, Server Action, health route | CI `unit` |
| Component | Jest + React Testing Library | `__tests__/*.test.tsx` | Checkout form, modal, error slots behave for a user | CI `unit` |
| End-to-end | Playwright | `e2e/purchase.spec.ts` | Product → cart → checkout → order; order privacy (404 for others); empty cart redirect | CI `e2e` |
| Smoke | Playwright (`@smoke`) | `e2e/smoke.spec.ts` | Health (+ deployed SHA), home, product list, 404 | CI `e2e` and after every deploy |
| Container | Docker + curl | CI `docker` job | Image builds, has no fixable HIGH/CRITICAL CVEs, starts and reports healthy | CI `docker` |

- Coverage: `jest.config.mjs` has a **ratchet** set just under today's numbers. Coverage can't go down; raise the
  thresholds as tests are added. The table is written to each run's summary.
- E2E runs against `.next/standalone/server.js` (what the Docker image runs), not `next dev`.
- The purchase flow writes data, so it only runs in CI. Production gets the read-only `@smoke` specs.

## Run it locally

```bash
npm install
npm run lint && npm run typecheck
npm run test:ci                    # Jest + coverage
npx playwright install chromium    # once
npm run build && npm run test:e2e  # Playwright against the production build
BASE_URL=https://shop.example.com npm run test:smoke   # smoke-test any running environment
```

## Security choices in the workflows

- **OIDC, no AWS keys in GitHub.** Two roles with different trust:
  - **Build role:** ECR push only, assumable from `main`.
  - **Deploy role:** ECS rollout only, assumable only from the `production` environment.
  - A PR or another branch can assume neither.
- **Every action pinned to a commit SHA** (version in a comment). Dependabot bumps them weekly.
- **Least privilege:**
  - `permissions: contents: read` by default, `id-token: write` only on the AWS jobs.
  - `persist-credentials: false` on checkout.
- **No untrusted input in `run:`.** Values go through `env:` and quoted variables (`actionlint` + shellcheck clean).
- **Supply chain:**
  - Image scan blocks HIGH/CRITICAL fixable CVEs.
  - Dependency review on PRs.
  - Immutable, SHA-tagged images.
- **Reproducibility:** the image that passed CI is the one deployed. A re-run for the same commit reuses it.
- **`concurrency`:** deploys and rollbacks share one lock and are never cancelled half-way.

## One-time GitHub setup

1. Create the repo and push (see below).
2. **Settings → Branches → main:**
   - Require a pull request.
   - Require the status check **"CI passed"**.
   - Block force pushes.
3. **Settings → Environments:**
   - `production`: required reviewers, deployment branch `main`.
   - `infra`: the same rules.
4. Variables and secrets: see the table in [DEPLOYMENT.md](DEPLOYMENT.md#github-configuration).
   - Add `AWS_BUILD_ROLE_ARN`.
   - Without `AWS_DEPLOY_ENABLED=true`, CD runs only the CI gate, so it's safe before AWS exists.
5. Optional: add a `CODEOWNERS` entry for `.github/` and `infra/` so pipeline and infra changes need your review.

```bash
git init -b main
git add .
git commit -m "Add CI/CD pipeline"
git remote add origin git@github.com:OWNER/nextjs-shop.git
git push -u origin main
```

## Next steps

- **Staging environment:** a second Terraform state (`environment = "staging"`) and a `deploy-staging` job before
  production that runs the full Playwright suite there.
- **Preview environments** per PR (ECS service per branch, or Vercel for previews only).
- **Image signing and provenance:** `actions/attest-build-provenance`, verified before deploy.
- **Blue/green with CodeDeploy:** instant traffic switch and rollback instead of rolling.
