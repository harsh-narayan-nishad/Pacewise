# Frontend

**OOPs · Frontend.** The Pacewise web app mixes React components (functions) with TypeScript classes for the logic behind them. This page shows the object-oriented parts and why they exist.

## Classes and interfaces in the app
| Class / interface | Job |
|---|---|
| `KeyValueStore` (interface) | "get, set, remove, keys": the only thing repositories know about storage |
| `BrowserKeyValueStore`, `MemoryKeyValueStore` | Two interchangeable implementations (real browser, tests) |
| `SyncingKeyValueStore` | Wraps any store and also sends saved data to the backend |
| `UserNamespace` | Builds and parses storage keys for a user |
| `UserSession` | Holds every repository of the signed-in user |
| History, streak, bookmarks ... repositories | Each owns one kind of data |
| `ScopedTokenStore` | Keeps tokens separate for each demo user |
| `DevDataStore` | Social data (likes, comments, follows ...) with change notifications |
| `PresenceTracker` / `readingPresence` | Counts reading time from a heartbeat |
| `BackendSync`, `BackendTracking` | Sync with the server; queue and retry events |

## The four pillars
- **Encapsulation**: `BackendTracking` keeps its queue and timers private; screens call `trackTime(...)` and cannot corrupt the queue. `UserNamespace` is the only place that knows the key format.
- **Abstraction**: a repository asks a `KeyValueStore` to save; it does not know whether that is `localStorage`, memory or the server.
- **Inheritance / interface implementation**: stores implement `KeyValueStore`. Favour composition (below); inheritance is kept shallow.
- **Polymorphism**: tests pass `MemoryKeyValueStore`, the app passes the syncing store; repository code is identical.

## Design patterns
| Pattern | Where |
|---|---|
| **Decorator** | `SyncingKeyValueStore` adds cloud saving without editing any repository |
| **Facade** | `lib/storage.ts` keeps the old function names and forwards to the session classes |
| **Repository** | One class per kind of saved data |
| **Observer** | `devDataStore.onLocalChange` and React's `useSyncExternalStore` subscription |
| **Singleton** | `devDataStore`, `backendSync`, `backendTracking`, `tokenStore` are created once |
| **Composition root** | `lib/session/composition.ts` is the one place that chooses concrete classes |
| **Single-flight (promise sharing)** | One shared token refresh for all waiting requests |

## SOLID in this code
- **S**: `syncPolicy.ts` only decides ownership; `dateKey.ts` only formats days.
- **O**: a new synced collection is one name in a list, not a new branch in the loop.
- **L**: any `KeyValueStore` can stand in for another.
- **I**: the interface has four small methods.
- **D**: repositories depend on the interface, and the composition root supplies the class.

## Classes and React
React components are functions with hooks; they use classes through singletons and subscriptions rather than extending them. Prefer composition: a screen *has* a session; it is not a kind of session. Types are `strict` TypeScript, so a wrong call is a compile error (a form of design by contract).

## Questions you can be asked
- Show polymorphism in this project.
- Why a decorator instead of editing the repositories?
- Composition or inheritance here, and why?
- What does the composition root buy you in tests?
