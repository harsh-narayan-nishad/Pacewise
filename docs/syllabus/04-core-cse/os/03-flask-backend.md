# Flask backend

**Operating system · Flask backend.** Pacewise's API is Express. This page shows how the same operating-system ideas appear when the backend is Flask (Python). Nothing here is built into Pacewise yet.

## Processes and threads: the biggest difference
| | Node / Express | Python / Flask |
|---|---|---|
| Concurrency model | One thread with an event loop per process | **WSGI workers**: gunicorn starts several processes; each handles one request at a time (sync) or several (threads) |
| Use all CPU cores | Run several processes (replicas) | `gunicorn -w 4` (about 2 × cores + 1) |
| Parallel threads in one process | Not for JavaScript code | Limited by the **GIL**: only one thread runs Python bytecode at a time, but threads still help while waiting for I/O (database, network) |
| CPU-heavy work | Blocks the loop | Blocks that worker only; other workers keep serving |
| Idle connections (SSE) | Cheap | One worker or thread each, unless using `gevent` or an async framework |

## The GIL in plain words
The Global Interpreter Lock lets one thread run Python code at a time in a process. Waiting for MongoDB releases it, so many threads still overlap I/O. Pure calculation does not speed up with more threads, only with more processes. Password hashing with the `bcrypt` package runs in C and releases the lock, so it does not stall other threads the way pure-JavaScript `bcryptjs` stalls Node's loop.

## Process management
- **Master/worker model**: gunicorn's master process forks workers and restarts any that die. `--max-requests 1000 --max-requests-jitter 100` recycles workers to cap slow memory growth.
- **Signals**: `SIGTERM` makes gunicorn stop accepting, finish running requests (`--graceful-timeout`) and exit; `SIGHUP` reloads configuration; `SIGKILL` cannot be caught.
- **Fork and shared memory**: each worker has its own copy of globals, so an in-memory rate-limit dictionary is per worker. Shared state goes to Redis or the database, exactly as with Express replicas.
- **Timeouts**: `--timeout 30` kills a worker stuck on one request so it cannot hold a slot forever.

## Environment and files
- Configuration through environment variables (`os.environ`) or a `.env` loaded at start; validated once so a missing `MONGODB_URI` stops start-up.
- Uploaded files should not be written to the container's disk (it disappears on redeploy); use S3 with signed URLs like the current design.
- Open sockets and files are file descriptors; `ulimit -n` caps them per process.

## Questions you can be asked
- What is the GIL and when does it matter?
- Why does gunicorn use several processes?
- Threads vs processes vs async for a Flask API?
- What happens to in-flight requests when the container receives SIGTERM?
