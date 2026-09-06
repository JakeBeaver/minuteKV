import type { IncomingMessage, ServerResponse } from 'node:http';
import * as kvStore from './kvStore.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
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

export async function handlePost(key: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  kvStore.set(key, body);
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

export function handleRateLimited(res: ServerResponse): void {
  res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '1' });
  res.end('Rate limit exceeded');
}
