import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Small on purpose, so the size-limit tests below don't need huge bodies.
// Must be set before kvStore.ts/routes.ts (and their import of config.ts)
// are evaluated — and since static imports are hoisted above this
// assignment regardless of where they're written, both are imported
// dynamically here rather than statically at the top of the file.
process.env.MAX_ENTRY_LENGTH = '10';
const kvStore = (await import('../src/kvStore.ts')).default;
const routes = await import('../src/routes.ts');

/** Minimal fake ServerResponse that records what handlers write. */
function fakeRes() {
  return {
    statusCode: undefined as number | undefined,
    headers: undefined as Record<string, string> | undefined,
    body: undefined as string | undefined,
    writeHead(status: number, headers: Record<string, string>) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk?: string) {
      this.body = chunk ?? '';
    },
  };
}

/** Minimal fake IncomingMessage: an EventEmitter that emits a body then ends. */
function fakeReq(body = ''): EventEmitter & { destroy?: () => void; resume?: () => void } {
  const req = new EventEmitter() as EventEmitter & { destroy?: () => void; resume?: () => void };
  req.destroy = () => {};
  req.resume = () => {};
  queueMicrotask(() => {
    if (body) req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

test('handleGet returns 404 for a missing key', async () => {
  const res = fakeRes();
  await routes.handleGet('does-not-exist', res as any);
  assert.equal(res.statusCode, 404);
});

test('handleGet returns 200 and the value for a present key', async () => {
  kvStore.set('routes-test-key', 'the-value');
  const res = fakeRes();
  await routes.handleGet('routes-test-key', res as any);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'the-value');
});

test('handlePost stores the request body and returns 200', async () => {
  const res = fakeRes();
  await routes.handlePost('short', fakeReq('fits') as any, res as any, false);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'OK');
  assert.equal(kvStore.get('short'), 'fits');
});

test('handlePost tags the stored key as admin-owned when isAdmin is true', async () => {
  const res = fakeRes();
  await routes.handlePost('admin-k', fakeReq('yes') as any, res as any, true);
  assert.equal(res.statusCode, 200);
  assert.equal(kvStore.get('admin-k'), 'yes');
});

test('handlePost returns 413 when key + value exceed MAX_ENTRY_LENGTH', async () => {
  const res = fakeRes();
  await routes.handlePost('k', fakeReq('way-too-long-for-the-limit') as any, res as any, false);
  assert.equal(res.statusCode, 413);
  assert.equal(kvStore.get('k'), undefined);
});

test('handlePost returns 413 when the key alone already exceeds MAX_ENTRY_LENGTH', async () => {
  const res = fakeRes();
  await routes.handlePost('a-key-longer-than-ten-chars', fakeReq('') as any, res as any, false);
  assert.equal(res.statusCode, 413);
});

test('handleMethodNotAllowed returns 405', () => {
  const res = fakeRes();
  routes.handleMethodNotAllowed(res as any);
  assert.equal(res.statusCode, 405);
});

test('handleMissingKey returns 400', () => {
  const res = fakeRes();
  routes.handleMissingKey(res as any);
  assert.equal(res.statusCode, 400);
});

test('handleEntryTooLarge returns 413', () => {
  const res = fakeRes();
  routes.handleEntryTooLarge(res as any);
  assert.equal(res.statusCode, 413);
});
