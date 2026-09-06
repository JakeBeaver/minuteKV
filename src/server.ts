import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { PORT } from './config.ts';
import * as rateLimiter from './rateLimiter.ts';
import * as auth from './auth.ts';
import * as routes from './routes.ts';

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ip = req.socket.remoteAddress ?? 'unknown';
  const key = (req.url ?? '').slice(1);
  const admin = auth.isAdmin(req);

  if (!admin && !rateLimiter.allow(ip)) {
    return routes.handleRateLimited(res);
  }

  if (!key) {
    return routes.handleMissingKey(res);
  }

  if (req.method === 'GET') {
    return routes.handleGet(key, res);
  }

  if (req.method === 'POST') {
    return routes.handlePost(key, req, res);
  }

  return routes.handleMethodNotAllowed(res);
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    });
  });
}

// Only bind to a port when this file is run directly (e.g. `node server.ts`),
// not when it's imported by tests.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`KV server running at http://localhost:${PORT}`);
  });
}
