import { NextResponse } from "next/server";

/**
 * Liveness check for the ALB target group and the ECS container health check.
 * Cheap on purpose: no db reads, never cached.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.DEPLOYMENT_VERSION ?? "local",
  });
}
