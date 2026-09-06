# minuteKV

A tiny perishable key-value HTTP service.

The store has two eviction rules:

- **Timeout elapsed**: a key is dropped `EVICTION_MS` (default 60s) after it
  was last written, admin-written or not.
- **Maximum size reached**: writing a *new* key while the store already
  holds `MAX_ENTRIES` (default 10,000) keys evicts the oldest non-admin key
  to make room. A request carrying the correct `x-api-key` header writes an
  admin-owned key, which is skipped by this rule — so a flood of ordinary
  traffic can't push admin-written data out just to make space. (If every
  stored key happens to be admin-owned, the oldest one is evicted anyway,
  so the cap always holds.)

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
| `ADMIN_API_KEY`  | `change-me-please`   | Value required in the `x-api-key` header to write an admin-protected key. **Set this in any real deployment.** |
| `PORT`           | `3000`               | HTTP port to listen on.                 |
| `MAX_ENTRIES`    | `10000`              | Max keys held at once; writing past this evicts the oldest non-admin key. |

## API

| Method | Path    | Behavior                                            |
| ------ | ------- | ---------------------------------------------------- |
| `GET`  | `/:key` | Returns the stored value, or `404` if unset/expired. |
| `POST` | `/:key` | Stores the request body as the value for `:key`.     |

Any other method returns `405`. A request with no key in the path returns
`400`.

```bash
curl -X POST localhost:3000/foo -d 'hello'
curl localhost:3000/foo
# hello

# write an admin-protected key, immune to capacity eviction
curl -X POST -H "x-api-key: $ADMIN_API_KEY" localhost:3000/foo -d 'hello'
```

## Test

```bash
npm test
```

Runs the full suite with Node's built-in test runner (`node --test`) — unit
tests for the store and auth helper, plus an end-to-end test that spins up
a real server on an ephemeral port and exercises it over HTTP.

## Layout

```
src/
  config.ts   # tunables, read from env where noted
  kvStore.ts  # perishable, capacity-bounded store (createKvStore factory + default singleton)
  auth.ts     # constant-time admin key check
  routes.ts   # request handlers
  server.ts   # wiring + HTTP server
test/
  *.test.ts   # node:test suites, one per module, plus a server integration test
```
