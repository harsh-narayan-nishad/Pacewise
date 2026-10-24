# 01 · JavaScript & TypeScript

## Easy
1. **`var` vs `let` vs `const`?** `var` is function-scoped and hoisted (initialised `undefined`); `let`/`const` are block-scoped with a temporal dead zone. `const` forbids rebinding, not mutation.
2. **`==` vs `===`?** `==` coerces types; `===` doesn't. Use `===`; the one idiom for `==` is `x == null`.
3. **What is a closure?** A function plus the variables of the scope it was created in. Used for private state, memoisation, debouncing. *Here:* `useInertiaScroll` keeps `target` in a closure shared by the wheel/key handlers.
4. **`map` / `filter` / `reduce`?** Pure array transforms returning new values; `forEach` returns nothing.
5. **`null` vs `undefined`?** `undefined` = never assigned; `null` = intentionally empty.
6. **TS: `interface` vs `type`?** Both describe shapes; interfaces merge and extend, types do unions/intersections/mapped types.

## Medium
1. **Explain the event loop.** Call stack → microtask queue (promises, `queueMicrotask`) drained fully → one macrotask (timers, I/O, events) → render → repeat. `await` continues as a microtask. Consequence: a never-ending microtask chain starves rendering.
2. **How does `this` work?** Determined by call-site: method call, `call/apply/bind`, `new`, default (undefined in strict mode). Arrow functions capture lexical `this`.
3. **Debounce vs throttle — implement debounce.**
   ```ts
   const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
     let t: ReturnType<typeof setTimeout>;
     return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
   };
   ```
4. **Promise combinators.** `all` (fails fast), `allSettled` (never rejects), `race` (first to settle), `any` (first to fulfil). Know which to use for "load all or fail" vs "best effort".
5. **Prototype chain & `class`.** Classes are syntax over prototypes; method lookup walks `__proto__`. *Here:* the editor engine and backend classes use ES classes — see `docs/OOP_ARCHITECTURE.md`.
6. **TS generics & narrowing.** Discriminated unions + exhaustive `switch` with a `never` check. *Here:* `ReadingContext` actions are a discriminated union on `type`.
7. **Why does TS narrow `let x: T | null = null` to `null`?** Control-flow analysis sees only the assignment, not closure writes — cast `null as T | null` (fixed in `formatCode.ts`).

## Hard
1. **Implement `Promise.all` / a promise pool with concurrency N.** Maintain an index and N workers each pulling the next task; resolve when all settle; keep result order by index.
2. **Memory leaks in SPAs.** Detached DOM nodes, un-removed listeners/intervals, closures holding big objects, unbounded caches. Detect: heap snapshots, "detached" filter. *Here:* every `useEffect` that adds a listener/`requestAnimationFrame` returns a cleanup.
3. **Deep clone / deep equal edge cases.** Cycles (WeakMap), Dates, Maps/Sets, property descriptors, `structuredClone` limits (no functions).
4. **TS advanced types.** Build `DeepReadonly<T>`, `Pick`-by-value-type, a typed `EventEmitter<Events>`; explain variance, `infer`, template-literal types.
5. **Module systems.** ESM (static, live bindings, tree-shakable) vs CJS (dynamic, copies); dual-package hazards; why Next needs `"use client"` boundaries.
6. **Design an undo/redo stack for a rich-text editor.** Command pattern + coalescing of typing bursts + selection snapshots. *Here:* the dependency-free editor in `lib/editor/**`.
