# Express backend

**Operating system · Express backend.** How the Pacewise API (Express + TypeScript + MongoDB) uses Operating system concepts.

## One process, one event loop
Node.js runs your JavaScript on a **single thread** with an **event loop**. While a request waits for MongoDB, the thread serves other requests. That is why one process handles thousands of connections, and why a slow synchronous task blocks everyone.

| Work | Where it runs |
|---|---|
| Parsing JSON, routing, zod validation | The main thread (fast) |
| Network reads and writes (sockets) | The operating system's I/O notification (epoll on Linux); the thread is told when data is ready |
| File system, DNS lookup, crypto | libuv's thread pool (4 threads by default) |
| Password hashing with `bcryptjs` | The main thread (pure JavaScript), about a quarter of a second at cost 12 |

**Honest weak spot:** because `bcryptjs` is pure JavaScript, a burst of sign-ins briefly stalls other requests. The usual fix is the native `bcrypt` package (runs in the thread pool) or a limit on sign-in rate, which this API already has (20 a minute).

## Processes and scaling
- A **process** has its own memory. Two API processes cannot see each other's variables, so anything that must be shared (rate-limit counters, live events, data) lives in Redis or MongoDB, never in a global variable.
- **Replicas** (`docker compose up --scale api=3`) use more CPU cores. Node uses one core per process.
- The in-memory fallback for rate limits is correct for one instance only; that is stated in the README.

## Sockets and file descriptors
Every open connection (a browser, MongoDB, Redis, an SSE stream) is a **file descriptor**. The operating system limits how many one process may hold (`ulimit -n`). Many open SSE streams use descriptors and a little memory each, which is why heartbeats and cleanup on `close` matter: a client that vanishes must be removed or the process slowly leaks.

## Memory
- The Node heap is managed by a garbage collector; objects nobody references are freed.
- The in-memory rate-limit map would grow forever without cleanup, so old windows are removed once it passes 50 000 entries.
- Large uploads never enter memory: the browser sends the file straight to storage using a signed URL.

## Signals and graceful shutdown
When a container is stopped the OS sends **SIGTERM**. The server then:
1. stops accepting new connections (`server.close`),
2. lets running requests finish,
3. closes the MongoDB and Redis connections,
4. exits; a 10-second timer forces exit if something hangs.
This avoids dropped responses during deploys. `SIGINT` (Ctrl+C) does the same.

## Environment, configuration, security
- Settings come from **environment variables**, validated once at start by zod; a missing `MONGODB_URI` stops the process with a clear message instead of failing later.
- The container runs with no local state, so it can be killed and replaced at any time.
- Secrets (JWT keys, database URL) stay in `.env`, which is never committed or zipped.

## Concurrency ideas shown here
| Idea | Example |
|---|---|
| Race condition | Two clicks create two reactions at once. A unique index on (story, user) makes the database refuse the second. |
| Atomic operation | `$inc` on a counter is one indivisible step, so two requests never read the same old value. |
| Critical section | The sync sequence number is taken with one atomic update so every change gets a distinct number. |
| Starvation / blocking | A long synchronous loop in a handler would freeze every other request on that process. |

## Questions you can be asked
- Is Node.js single-threaded? What does the thread pool do?
- Why can't two API replicas share an in-memory counter?
- What is a signal, and what does graceful shutdown mean?
- How would you find which part of a request blocks the event loop?
