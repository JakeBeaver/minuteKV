import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as routes from '../src/routes.ts';
import * as kvStore from '../src/kvStore.ts';

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
function fakeReq(body = ''): EventEmitter {
  const req = new EventEmitter();
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
  await routes.handlePost('routes-test-post', fakeReq('posted-body') as any, res as any);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'OK');
  assert.equal(kvStore.get('routes-test-post'), 'posted-body');
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

test('handleRateLimited returns 429 with Retry-After', () => {
  const res = fakeRes();
  routes.handleRateLimited(res as any);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers?.['Retry-After'], '1');
});
