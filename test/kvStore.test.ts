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
