/**
 * @jest-environment node
 */
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  afterEach(() => {
    delete process.env.DEPLOYMENT_VERSION;
  });

  it("returns ok with a local version by default", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok", version: "local" });
  });

  it("reports the deployed git SHA", async () => {
    process.env.DEPLOYMENT_VERSION = "abc123";
    const res = GET();
    await expect(res.json()).resolves.toMatchObject({ version: "abc123" });
  });
});
