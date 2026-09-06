import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createKvStore } from '../src/kvStore.ts';

test('set/get round-trips a value', () => {
  const store = createKvStore(1000);
  store.set('a', 'hello');
  assert.equal(store.get('a'), 'hello');
});

test('get returns undefined for a missing key', () => {
  const store = createKvStore(1000);
  assert.equal(store.get('nope'), undefined);
});

test('overwriting a key updates its value', () => {
  const store = createKvStore(1000);
  store.set('a', 'first');
  store.set('a', 'second');
  assert.equal(store.get('a'), 'second');
});

test('entries are evicted after evictionMs', async () => {
  const store = createKvStore(30);
  store.set('a', 'hello');
  assert.equal(store.get('a'), 'hello');
  await delay(80);
  assert.equal(store.get('a'), undefined);
  assert.equal(store.has('a'), false);
});

test('rewriting a key resets its eviction timer', async () => {
  const store = createKvStore(50);
  store.set('a', 'first');
  await delay(30);
  store.set('a', 'second'); // resets the 50ms clock
  await delay(30);
  // 60ms since first write, but only 30ms since the reset — still alive.
  assert.equal(store.get('a'), 'second');
  await delay(40);
  assert.equal(store.get('a'), undefined);
});

test('remove deletes a key and cancels its timer', () => {
  const store = createKvStore(1000);
  store.set('a', 'hello');
  assert.equal(store.remove('a'), true);
  assert.equal(store.get('a'), undefined);
  assert.equal(store.remove('a'), false);
});

test('size reflects the number of live keys', () => {
  const store = createKvStore(1000);
  assert.equal(store.size(), 0);
  store.set('a', '1');
  store.set('b', '2');
  assert.equal(store.size(), 2);
  store.remove('a');
  assert.equal(store.size(), 1);
});

test('separate store instances do not share state', () => {
  const storeA = createKvStore(1000);
  const storeB = createKvStore(1000);
  storeA.set('a', '1');
  assert.equal(storeB.get('a'), undefined);
});

test('overwriting an existing key never evicts anything, even at capacity', () => {
  const store = createKvStore(1000, 2);
  store.set('a', '1');
  store.set('b', '2');
  assert.equal(store.size(), 2);

  store.set('a', 'updated'); // overwrite, not a new key
  assert.equal(store.size(), 2);
  assert.equal(store.get('a'), 'updated');
  assert.equal(store.get('b'), '2');
});

test('a new key past capacity evicts the oldest non-admin key', () => {
  const store = createKvStore(1000, 2);
  store.set('a', '1');
  store.set('b', '2');

  store.set('c', '3'); // new key, store full -> oldest ('a') is evicted
  assert.equal(store.size(), 2);
  assert.equal(store.get('a'), undefined);
  assert.equal(store.get('b'), '2');
  assert.equal(store.get('c'), '3');
});

test('admin-written keys are skipped when evicting for space', () => {
  const store = createKvStore(1000, 2);
  store.set('admin-key', 'protected', true);
  store.set('b', '2');

  // Store is full; 'admin-key' is oldest but admin-owned, so 'b' (the
  // oldest non-admin key) is evicted instead.
  store.set('c', '3');
  assert.equal(store.size(), 2);
  assert.equal(store.get('admin-key'), 'protected');
  assert.equal(store.get('b'), undefined);
  assert.equal(store.get('c'), '3');
});

test('if every stored key is admin-owned, the oldest is evicted anyway to hold the cap', () => {
  const store = createKvStore(1000, 2);
  store.set('a', '1', true);
  store.set('b', '2', true);

  store.set('c', '3', true);
  assert.equal(store.size(), 2);
  assert.equal(store.get('a'), undefined); // oldest, evicted despite being admin
  assert.equal(store.get('b'), '2');
  assert.equal(store.get('c'), '3');
});

test('a key overwritten by a non-admin write loses its admin protection', () => {
  const store = createKvStore(1000, 2);
  store.set('a', 'first', true);
  store.set('b', '2');
  store.set('a', 'second', false); // same key, now written by a non-admin

  // 'a' is now the most-recently-written key, but no longer admin-owned.
  store.set('c', '3'); // new key, store full -> oldest non-admin is 'b'
  assert.equal(store.get('b'), undefined);
  assert.equal(store.get('a'), 'second');
  assert.equal(store.get('c'), '3');
});

test('timeout eviction applies to admin-written keys too', async () => {
  const store = createKvStore(30);
  store.set('admin-key', 'value', true);
  await delay(80);
  assert.equal(store.get('admin-key'), undefined);
});
