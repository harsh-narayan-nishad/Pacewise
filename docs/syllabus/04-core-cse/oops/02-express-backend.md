# Express backend

**OOPs · Express backend.** How the Pacewise API (Express + TypeScript + MongoDB) uses OOPs concepts.

## The layers (separation of concerns)
```text
routes      -> which URL runs which handler, plus middleware
controller  -> reads the request, calls a service, writes the response
service     -> the real rules (who may do what, which documents change)
models      -> the shape of the data in MongoDB
```
A controller never touches the database; a service never touches `req` or `res`. Each layer can be tested and changed on its own.

## The four pillars, with real examples
| Pillar | Where |
|---|---|
| **Encapsulation** | `UserNamespace` is the only code that knows the storage key format; `ScopedTokenStore` hides which user's tokens are in use; `BackendTracking` hides its queue and retry logic behind `trackTime()`. |
| **Abstraction** | `KeyValueStore` is an interface: repositories only know "get, set, remove, keys", not whether that is browser storage, memory or a server. |
| **Inheritance** | `AppError` is the base class; `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError` extend it with a status code, so the one error handler can turn any of them into the right HTTP response. |
| **Polymorphism** | `BrowserKeyValueStore`, `MemoryKeyValueStore` and `SyncingKeyValueStore` are interchangeable wherever a `KeyValueStore` is expected. |

## Design patterns used
| Pattern | Where | Benefit |
|---|---|---|
| **Decorator** | `SyncingKeyValueStore` wraps a store and also sends saved data to the backend | The history, streak and bookmark classes needed no change to gain cloud storage |
| **Strategy** | Rate limiting uses Redis when configured, an in-memory map otherwise | Same middleware, different storage, chosen at start |
| **Chain of responsibility** | The Express middleware chain (security, CORS, parse, auth, rate limit, validate, handler) | Each step does one job and either passes on or stops the request |
| **Singleton** | One MongoDB connection, one Redis client, one `backendSync` object | Shared pool; no per-request connections |
| **Observer** | `devDataStore.onLocalChange` tells the sync layer something changed; the event bus fans notifications out to open streams | The store does not know who is listening |
| **Repository** | The session layer's history, streak, bookmarks classes | Data access in one place per kind of data |
| **Facade** | `lib/storage.ts` keeps the old API while forwarding to the new session classes | No screen had to be rewritten |
| **Composition root** | `lib/session/composition.ts` is the one file that decides which concrete classes are wired together | Swapping storage is a one-file edit |

## SOLID in short
- **S**ingle responsibility: `policy.ts` only decides permissions; `consistency.ts` only does streak maths.
- **O**pen/closed: adding a new synced collection means adding a name and a rule, not changing the sync loop.
- **L**iskov: any `KeyValueStore` can replace another without callers noticing.
- **I**nterface segregation: `KeyValueStore` has four small methods, not a large storage API.
- **D**ependency inversion: repositories depend on the interface; the composition root supplies the concrete store.

## Pure functions beside the classes
`authorize`, `canRead` and `computeConsistency` take values and return values, with no database and no clock hidden inside. That is why they run in `node:test` in milliseconds with 16 passing tests. Object-oriented design and pure functions work together: classes hold wiring and state, pure functions hold the rules.

## Honest limits
- Some service modules are plain functions, not classes. In TypeScript a module of functions is often the clearer choice; classes are used where there is state or a need for interchangeable parts.
- `BackendSync` is a large class (push, pull, restore, polling). If it grows, split it into `Pusher`, `Puller` and `Scheduler`.

## Questions you can be asked
- Show polymorphism in a project you built.
- Why a decorator rather than editing the existing class?
- What is dependency inversion and how did it help here?
- Composition or inheritance, and when?
