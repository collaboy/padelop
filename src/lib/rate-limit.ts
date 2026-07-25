// Lightweight in-memory rate limiter for serverless API routes.
//
// This resets whenever the function's container cold-starts and isn't
// shared across regions/instances, so it's not a hard guarantee — but it's
// a real, zero-dependency backstop against a single user (or script)
// hammering a paid AI endpoint. Upgrade to a Redis-backed limiter
// (e.g. Upstash) if usage grows enough to need cross-instance accuracy.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
