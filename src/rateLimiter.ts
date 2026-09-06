import { RATE_LIMIT, RATE_WINDOW_MS, RATE_LIMITER_MAX_CLIENTS } from './config.ts';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiter {
  allow(id: string): boolean;
  size(): number;
}

/**
 * Creates an independent token-bucket rate limiter: `limit` tokens per
 * `windowMs`, refilling continuously (not in discrete steps).
 *
 * Per-client state lives in one global map capped at `maxClients` entries,
 * rather than growing without bound for every distinct id ever seen. A
 * `Map`'s iteration order is insertion order, and every access here
 * re-inserts the touched entry, so that order doubles as
 * least-recently-used order:
 *
 *   - Touching an id already tracked (a "reuse") never evicts anything —
 *     it just bumps that id to the most-recently-used end.
 *   - Touching a brand-new id while at capacity evicts the
 *     least-recently-used client first, to make room. That client simply
 *     starts over with a fresh, full bucket if it comes back later.
 */
export function createRateLimiter(
  limit: number = RATE_LIMIT,
  windowMs: number = RATE_WINDOW_MS,
  maxClients: number = RATE_LIMITER_MAX_CLIENTS,
): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function allow(id: string): boolean {
    const now = Date.now();
    const existing = buckets.get(id);

    if (!existing && buckets.size >= maxClients) {
      // Reusing an existing key never gets here, so this only ever evicts
      // to make room for a genuinely new client.
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }

    const bucket: Bucket = existing || { tokens: limit, lastRefill: now };

    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed / windowMs) * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;

    // Delete-then-set moves this id to the end even when it already
    // existed, marking it most-recently-used.
    buckets.delete(id);
    buckets.set(id, bucket);

    return allowed;
  }

  function size(): number {
    return buckets.size;
  }

  return { allow, size };
}

// Default, process-wide limiter used by the running server.
const defaultLimiter = createRateLimiter();

export const allow = defaultLimiter.allow;
export const size = defaultLimiter.size;
