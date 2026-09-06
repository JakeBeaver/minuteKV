import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// Must be set before server.ts (and its import of config.ts) is evaluated.
process.env.ADMIN_API_KEY = 'test-admin-key';
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
  const res = await fetch(`${baseUrl}/`, { headers: adminHeaders });
  assert.equal(res.status, 400);
});

test('GET on an unset key returns 404', async () => {
  const res = await fetch(`${baseUrl}/never-set`, { headers: adminHeaders });
  assert.equal(res.status, 404);
});

test('POST then GET round-trips a value', async () => {
  const postRes = await fetch(`${baseUrl}/widget`, {
    method: 'POST',
    headers: adminHeaders,
    body: 'gear-shaped',
  });
  assert.equal(postRes.status, 200);

  const getRes = await fetch(`${baseUrl}/widget`, { headers: adminHeaders });
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), 'gear-shaped');
});

test('unsupported method returns 405', async () => {
  const res = await fetch(`${baseUrl}/widget`, { method: 'DELETE', headers: adminHeaders });
  assert.equal(res.status, 405);
});

test('wrong x-api-key is simply treated as a non-admin client, not an error', async () => {
  const res = await fetch(`${baseUrl}/widget`, { headers: { 'x-api-key': 'wrong' } });
  assert.equal(res.status, 200); // still under the rate limit at this point
});

test('a plain client is eventually rate limited, but an admin client is not', async () => {
  // RATE_LIMIT is 10 tokens; the previous test already spent one of this
  // client's tokens, so a handful more should exhaust the bucket.
  let sawRateLimited = false;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${baseUrl}/widget`);
    if (res.status === 429) {
      sawRateLimited = true;
      assert.equal(res.headers.get('retry-after'), '1');
      break;
    }
  }
  assert.equal(sawRateLimited, true, 'expected to eventually receive a 429');

  // The admin key bypasses the limiter entirely, even while the plain
  // bucket above is fully exhausted.
  const adminRes = await fetch(`${baseUrl}/widget`, { headers: adminHeaders });
  assert.equal(adminRes.status, 200);
});
