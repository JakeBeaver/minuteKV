import { test } from 'node:test';
import assert from 'node:assert/strict';

// Deliberately leave ADMIN_API_KEY unset for this file, to cover the case
// where no admin key is configured at all.
delete process.env.ADMIN_API_KEY;
const { isAdmin } = await import('../src/auth.ts');

test('isAdmin is always false when ADMIN_API_KEY is not configured', () => {
  assert.equal(isAdmin({ headers: {} }), false);
  assert.equal(isAdmin({ headers: { 'x-api-key': '' } }), false);
  // In particular, the old hardcoded default key no longer works.
  assert.equal(isAdmin({ headers: { 'x-api-key': 'change-me-please' } }), false);
});
