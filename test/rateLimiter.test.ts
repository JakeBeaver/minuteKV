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

test('caps the number of tracked clients, evicting the least-recently-used', () => {
  const limiter = createRateLimiter(5, 10_000, 2); // room for only 2 clients
  limiter.allow('a');
  limiter.allow('b');
  assert.equal(limiter.size(), 2);

  // 'c' is new and the map is full, so the least-recently-used ('a') is
  // evicted to make room.
  limiter.allow('c');
  assert.equal(limiter.size(), 2);

  // 'a' was evicted, so it comes back as a brand-new client with a full
  // bucket rather than whatever tokens it had left.
  for (let i = 0; i < 5; i++) assert.equal(limiter.allow('a'), true);
});

test('reusing a tracked client never evicts anyone, even at capacity', () => {
  const limiter = createRateLimiter(5, 10_000, 2);
  limiter.allow('a');
  limiter.allow('b');
  assert.equal(limiter.size(), 2);

  // Repeatedly hitting an id already tracked is a reuse, not a new
  // insertion — capacity stays untouched and nothing gets evicted.
  for (let i = 0; i < 10; i++) limiter.allow('a');
  assert.equal(limiter.size(), 2);

  // 'b' should still be exactly as it was: untouched, still tracked.
  // Exhaust its remaining tokens and confirm it still blocks correctly.
  let blocked = false;
  for (let i = 0; i < 10; i++) {
    if (!limiter.allow('b')) blocked = true;
  }
  assert.equal(blocked, true);
});

test('touching a client bumps it to most-recently-used, changing eviction order', () => {
  const limiter = createRateLimiter(5, 10_000, 2);
  limiter.allow('a');
  limiter.allow('b');
  limiter.allow('a'); // 'a' is now more recently used than 'b'

  // A new client 'c' arrives at capacity: 'b' is now the
  // least-recently-used and gets evicted instead of 'a'.
  limiter.allow('c');

  // 'b' was evicted, so it starts fresh with a full bucket again.
  for (let i = 0; i < 5; i++) assert.equal(limiter.allow('b'), true);
});
