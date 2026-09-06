import type { IncomingMessage, ServerResponse } from 'node:http';
import kvStore from './kvStore.ts';
import { MAX_ENTRY_LENGTH } from './config.ts';

/**
 * Reads the request body, resolving `null` instead of the body once
 * `maxLength` characters have been exceeded. Keeps draining the stream
 * (rather than destroying it) even after that point: on a real socket,
 * destroying the request also tears down the response side of the same
 * HTTP/1.1 connection, which would kill the connection before an error
 * response could be sent back.
 */
function readBody(req: IncomingMessage, maxLength: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > maxLength) tooLarge = true;
    });
    req.on('end', () => resolve(tooLarge ? null : body));
    req.on('error', reject);
  });
}

export async function handleGet(key: string, res: ServerResponse): Promise<void> {
  const value = kvStore.get(key);
  if (value === undefined) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found or expired');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(value);
}

export async function handlePost(key: string, req: IncomingMessage, res: ServerResponse, isAdmin: boolean): Promise<void> {
  if (key.length > MAX_ENTRY_LENGTH) {
    req.resume(); // drain and discard the body we're not going to read
    return handleEntryTooLarge(res);
  }

  const body = await readBody(req, MAX_ENTRY_LENGTH - key.length);
  if (body === null) {
    return handleEntryTooLarge(res);
  }
  kvStore.set(key, body, isAdmin);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}

export function handleMethodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
}

export function handleMissingKey(res: ServerResponse): void {
  res.writeHead(400, { 'Content-Type': 'text/plain' });
  res.end('Missing key in path, e.g. /abc');
}

export function handleEntryTooLarge(res: ServerResponse): void {
  res.writeHead(413, { 'Content-Type': 'text/plain' });
  res.end(`Key + value must not exceed ${MAX_ENTRY_LENGTH} characters`);
}
