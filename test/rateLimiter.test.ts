import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createRateLimiter } from '../src/rateLimiter.ts';

test('allows up to the burst limit, then blocks', () => {
  const limiter = createRateLimiter(3, 10_000);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), false);
});

test('tracks separate buckets per id', () => {
  const limiter = createRateLimiter(1, 10_000);
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), false);
  // A different id has its own, untouched bucket.
  assert.equal(limiter.allow('b'), true);
});

test('refills over time', async () => {
  const limiter = createRateLimiter(1, 40); // 1 token per 40ms
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), false);
  await delay(60);
  assert.equal(limiter.allow('ip'), true);
});

test('never exceeds the configured limit even after a long idle period', async () => {
  const limiter = createRateLimiter(2, 20);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), true);
  await delay(200); // far longer than needed to refill to the cap
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), true);
  assert.equal(limiter.allow('ip'), false);
});
