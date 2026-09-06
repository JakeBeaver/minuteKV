import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { ADMIN_API_KEY } from './config.ts';

/**
 * Constant-time string comparison. Guards against timing attacks that
 * could otherwise leak the admin key one byte at a time.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // keep timing consistent
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * A request presenting the correct x-api-key header is treated as admin
 * and bypasses rate limiting, so it can't be starved by its own leaky
 * bucket while doing legitimate bulk operations.
 */
export function isAdmin(req: Pick<IncomingMessage, 'headers'>): boolean {
  const provided = req.headers['x-api-key'];
  return typeof provided === 'string' && safeCompare(provided, ADMIN_API_KEY);
}
