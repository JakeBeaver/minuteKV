# minuteKV

A tiny perishable key-value HTTP service.

- **Perishable**: every value evicts itself `EVICTION_MS` (default 60s) after
  it was last written.
- **Rate limited**: a token-bucket limiter caps each client IP at
  `RATE_LIMIT` requests per `RATE_WINDOW_MS` (default 10 requests / 10s).
  Per-client state lives in one global map capped at
  `RATE_LIMITER_MAX_CLIENTS` distinct clients; if a never-before-seen IP
  shows up while it's full, the least-recently-seen client is evicted to
  make room (it just starts over with a full bucket if it comes back).
  Traffic from a client already being tracked never triggers an eviction.
- **Admin key**: a request carrying the correct `x-api-key` header bypasses
  the rate limiter entirely, so legitimate bulk/admin traffic can't be
  starved by the same leaky bucket that protects the service from abuse.

No dependencies, no build step — plain TypeScript run directly by Node's
built-in type-stripping support (unflagged on recent Node 22.x/23.x
releases; older releases need `node --experimental-strip-types`). Only
type-erasable syntax is used — no enums, namespaces, or parameter
properties.

## Run

```bash
npm start
# or directly:
node src/server.ts
```

Configure via environment variables:

| Variable         | Default              | Meaning                                |
| ---------------- | -------------------- | --------------------------------------- |
| `ADMIN_API_KEY`  | `change-me-please`   | Value required in the `x-api-key` header to bypass rate limiting. **Set this in any real deployment.** |
| `PORT`           | `3000`               | HTTP port to listen on.                 |
| `RATE_LIMITER_MAX_CLIENTS` | `10000`     | Max distinct client IPs tracked by the rate limiter at once, LRU-evicted beyond that. |

## API

| Method | Path    | Behavior                                            |
| ------ | ------- | ---------------------------------------------------- |
| `GET`  | `/:key` | Returns the stored value, or `404` if unset/expired. |
| `POST` | `/:key` | Stores the request body as the value for `:key`.     |

Any other method returns `405`. A request with no key in the path returns
`400`. A non-admin client over its rate limit gets `429` with a
`Retry-After` header.

```bash
curl -X POST localhost:3000/foo -d 'hello'
curl localhost:3000/foo
# hello

# bypass rate limiting with the admin key
curl -H "x-api-key: $ADMIN_API_KEY" localhost:3000/foo
```

## Test

```bash
npm test
```

Runs the full suite with Node's built-in test runner (`node --test`) — unit
tests for the store, rate limiter, and auth helper, plus an end-to-end test
that spins up a real server on an ephemeral port and exercises it over HTTP.

## Layout

```
src/
  config.ts       # tunables, read from env where noted
  kvStore.ts      # perishable in-memory store (createKvStore factory + default singleton)
  rateLimiter.ts  # token-bucket limiter (createRateLimiter factory + default singleton)
  auth.ts         # constant-time admin key check
  routes.ts       # request handlers
  server.ts       # wiring + HTTP server
test/
  *.test.ts       # node:test suites, one per module, plus a server integration test
```
