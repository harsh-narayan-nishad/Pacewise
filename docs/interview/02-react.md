# 02 · React

## Easy
1. **Props vs state?** Props flow down and are read-only; state is owned by a component and triggers re-render when changed.
2. **Why `key` in lists?** Stable identity so reconciliation reuses/moves the right DOM + state. Never use array index for reorderable lists.
3. **Controlled vs uncontrolled inputs?** Controlled: value in state. Uncontrolled: DOM owns it, read via ref.
4. **`useEffect` dependency array?** Re-run when deps change; `[]` = mount/unmount only. Return a cleanup.
5. **What is lifting state up?** Move shared state to the nearest common parent.

## Medium
1. **`useMemo` / `useCallback` — when?** Only for referential stability to memoised children/effects or expensive computation. Measure first; they cost memory and complexity.
2. **`useReducer` vs `useState`?** Reducer for related transitions and testable logic. *Here:* `ReadingContext` is a reducer (`SET_READING_MODE` is ignored during reading/completed — a business rule living in one place).
3. **Context pitfalls?** Every consumer re-renders when the value changes. Split state/dispatch contexts (done here: `useReadingState` / `useReadingDispatch`), memoise values, or use selector libraries.
4. **Why do effects run twice in dev?** StrictMode double-invokes mount/unmount to expose missing cleanups. Fix the effect, don't remove StrictMode.
5. **Stale closure bug?** Handler captured an old state value. Fix with functional updates (`setN(n => n+1)`), refs, or correct deps.
6. **Hydration mismatch causes?** Different server/client output (`Date.now`, `window`, `localStorage`). Read browser-only data in `useEffect`. *Here:* `PlatformShowcase` loads history in an effect, not during render.
7. **Error boundaries?** Class/`error.tsx` catch render errors in the subtree (not event handlers or async). See `app/error.tsx`.

## Hard
1. **Explain reconciliation, Fiber and concurrent rendering.** Fiber makes work interruptible; transitions mark updates low-priority; `useDeferredValue`/`startTransition` keep input responsive; renders must be pure because they can be repeated/abandoned.
2. **Optimise a 10k-row list.** Virtualise (windowing), memoise rows, stable keys, avoid inline object props, move state down, batch updates, use `content-visibility`.
3. **Design a custom hook that drives a rAF loop safely.** Keep mutable state in refs, one `requestAnimationFrame` chain, cancel on unmount, respect `prefers-reduced-motion`, pause when hidden. *Here:* `useInertiaScroll`, `useReadingEngine`.
4. **Server Components vs Client Components.** RSC render on server, ship no JS, can't use state/effects; client components hydrate. Push `"use client"` to the leaves; pass server data down as props.
5. **State management at scale.** Server cache (React Query/SWR) vs UI state vs URL state vs form state; avoid one global store for everything.
6. **Accessible custom widget.** Roles, keyboard map, focus management/trapping, `aria-live`; *Here:* the scroll rail uses buttons with labels; the carousel buttons have `aria-label`s and disabled states.
