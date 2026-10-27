/**
 * Tiny sliding-window rate limiter (pure, injectable clock so it is easy to test).
 *
 * Demo-grade on purpose: state lives in this process only, and keys are never evicted.
 * With several containers (ECS/EKS) you need a shared store such as Redis, or a limit
 * at the edge (CloudFront/WAF/API gateway).
 */
export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
};

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((time) => t - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: windowMs - (t - recent[0]) };
      }
      recent.push(t);
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
