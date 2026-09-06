import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// Must be set before server.ts (and its import of config.ts) is evaluated.
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.MAX_ENTRIES = '2'; // small, so capacity eviction is easy to trigger
const { createServer } = await import('../src/server.ts');

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const adminHeaders = { 'x-api-key': 'test-admin-key' };

test('GET on a path with no key returns 400', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 400);
});

test('GET on an unset key returns 404', async () => {
  const res = await fetch(`${baseUrl}/never-set`);
  assert.equal(res.status, 404);
});

test('POST then GET round-trips a value', async () => {
  const postRes = await fetch(`${baseUrl}/widget`, { method: 'POST', body: 'gear-shaped' });
  assert.equal(postRes.status, 200);

  const getRes = await fetch(`${baseUrl}/widget`);
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), 'gear-shaped');
});

test('unsupported method returns 405', async () => {
  const res = await fetch(`${baseUrl}/widget`, { method: 'DELETE' });
  assert.equal(res.status, 405);
});

test('a wrong x-api-key is simply treated as a non-admin write', async () => {
  const res = await fetch(`${baseUrl}/widget`, { method: 'POST', headers: { 'x-api-key': 'wrong' }, body: 'still-written' });
  assert.equal(res.status, 200);
  assert.equal(await (await fetch(`${baseUrl}/widget`)).text(), 'still-written');
});

test('MAX_ENTRIES=2: writing new keys past capacity evicts old ones', async () => {
  await fetch(`${baseUrl}/cap-a`, { method: 'POST', body: '1' });
  await fetch(`${baseUrl}/cap-b`, { method: 'POST', body: '2' });
  await fetch(`${baseUrl}/cap-c`, { method: 'POST', body: '3' }); // store can hold only 2

  const [a, b, c] = await Promise.all(
    ['cap-a', 'cap-b', 'cap-c'].map(async (k) => (await fetch(`${baseUrl}/${k}`)).status),
  );
  // The most recent write always survives...
  assert.equal(c, 200);
  // ...and the cap holds: not all three can still be present.
  assert.ok(a === 404 || b === 404, 'expected the cap to have evicted an older key');
});

test('an admin-written key survives capacity pressure from other clients', async () => {
  await fetch(`${baseUrl}/protected`, { method: 'POST', headers: adminHeaders, body: 'safe' });
  await fetch(`${baseUrl}/flood1`, { method: 'POST', body: 'x' });
  await fetch(`${baseUrl}/flood2`, { method: 'POST', body: 'x' });
  await fetch(`${baseUrl}/flood3`, { method: 'POST', body: 'x' });

  const res = await fetch(`${baseUrl}/protected`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'safe');
});
