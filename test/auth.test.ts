import { test } from 'node:test';
import assert from 'node:assert/strict';

// config.ts reads ADMIN_API_KEY from the environment at import time, so it
// must be set before auth.ts (and its import of config.ts) is evaluated.
// A dynamic import (rather than a static one) lets this run first.
process.env.ADMIN_API_KEY = 'test-admin-key';
const { isAdmin, safeCompare } = await import('../src/auth.ts');

test('safeCompare matches equal strings', () => {
  assert.equal(safeCompare('secret', 'secret'), true);
});

test('safeCompare rejects different strings of the same length', () => {
  assert.equal(safeCompare('secreu', 'secret'), false);
});

test('safeCompare rejects strings of different lengths', () => {
  assert.equal(safeCompare('short', 'a-lot-longer'), false);
});

test('isAdmin is true when x-api-key matches the admin key', () => {
  const req = { headers: { 'x-api-key': 'test-admin-key' } };
  assert.equal(isAdmin(req), true);
});

test('isAdmin is false when x-api-key is wrong', () => {
  const req = { headers: { 'x-api-key': 'wrong-key' } };
  assert.equal(isAdmin(req), false);
});

test('isAdmin is false when the header is missing', () => {
  const req = { headers: {} };
  assert.equal(isAdmin(req), false);
});

test('isAdmin is false when the header is an array (repeated header)', () => {
  const req = { headers: { 'x-api-key': ['test-admin-key', 'test-admin-key'] } };
  assert.equal(isAdmin(req), false);
});
