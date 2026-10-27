# syntax=docker/dockerfile:1.10
# Multi-stage build for the Next.js standalone server (see next.config.ts: output "standalone").

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Git SHA from CI -> next.config.ts deploymentId (version skew protection on rolling deploys).
ARG DEPLOYMENT_VERSION=local
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Server Actions encryption key is baked in at build time. Pass the same key for every build so
# several tasks (and old/new tasks during a deploy) can decrypt each other's actions.
# Optional: without it Next.js generates a random key per build.
RUN --mount=type=secret,id=server_actions_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,required=false \
    npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
ARG DEPLOYMENT_VERSION=local
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
# The server only needs `node`. Drop npm/yarn from the runtime image: smaller attack surface, and their
# bundled dependencies are a common source of CVEs that would fail the image scan for code we never run.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
# standalone = server.js + traced node_modules; static assets and public/ must be copied in.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
