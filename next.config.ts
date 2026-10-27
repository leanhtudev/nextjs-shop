import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // IMPORTANT: new Next.js 16 projects ship with `cacheComponents: true`.
  // That switches on the new "use cache" model and removes the classic route
  // segment options this lab teaches (`export const revalidate`, `dynamicParams`).
  // We turn it off on purpose so you can learn classic ISR first.
  // See README.md ("Cache Components: what changes") for the new model.
  cacheComponents: false,
  // Docker/ECS: emit .next/standalone with a minimal server.js and only the node_modules it needs.
  output: "standalone",
  // Rolling deploys on ECS: tag assets with the build's git SHA so old and new tasks don't mix
  // assets (version skew). CI passes DEPLOYMENT_VERSION; unset locally.
  deploymentId: process.env.DEPLOYMENT_VERSION,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
