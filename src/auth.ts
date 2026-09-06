import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { ADMIN_API_KEY } from './config.ts';

/**
 * Constant-time string comparison. `crypto.timingSafeEqual` throws if its
 * two buffers aren't the same length, which is itself a length-dependent
 * (and thus timing-dependent) branch — so both inputs are hashed to a
 * fixed-length digest first. That sidesteps the length check entirely:
 * digests are always equal length, comparing them is always safe, and an
 * attacker learns nothing from how long the compared strings were.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * A request presenting the correct x-api-key header is treated as admin
 * and its writes are protected from capacity eviction. With no
 * ADMIN_API_KEY configured, admin auth is unavailable altogether — no
 * request can be admin, rather than every request matching a default key.
 */
export function isAdmin(req: Pick<IncomingMessage, 'headers'>): boolean {
  if (!ADMIN_API_KEY) return false;
  const provided = req.headers['x-api-key'];
  return typeof provided === 'string' && safeCompare(provided, ADMIN_API_KEY);
}
