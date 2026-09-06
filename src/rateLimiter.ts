import { RATE_LIMIT, RATE_WINDOW_MS } from './config.ts';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiter {
  allow(id: string): boolean;
}

/**
 * Creates an independent token-bucket rate limiter: `limit` tokens per
 * `windowMs`, refilling continuously (not in discrete steps).
 */
export function createRateLimiter(limit: number = RATE_LIMIT, windowMs: number = RATE_WINDOW_MS): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function allow(id: string): boolean {
    const now = Date.now();
    const bucket: Bucket = buckets.get(id) || { tokens: limit, lastRefill: now };

    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed / windowMs) * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;

    buckets.set(id, bucket);
    return allowed;
  }

  return { allow };
}

// Default, process-wide limiter used by the running server.
const defaultLimiter = createRateLimiter();

export const allow = defaultLimiter.allow;
