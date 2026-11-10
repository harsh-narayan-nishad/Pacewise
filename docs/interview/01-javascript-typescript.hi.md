# 01 · JavaScript & TypeScript

## Easy
1. **`var` vs `let` vs `const`?** `var` function-scoped होता है और hoist होता है (`undefined` से initialise); `let`/`const` block-scoped होते हैं और उनमें temporal dead zone होता है। `const` rebinding रोकता है, mutation नहीं।
2. **`==` vs `===`?** `==` types को coerce करता है; `===` नहीं करता। `===` इस्तेमाल करें; `==` का एकमात्र idiom `x == null` है।
3. **Closure क्या है?** एक function और उस scope के variables जिसमें वह बना था। Private state, memoisation, debouncing के लिए इस्तेमाल होता है। *यहाँ:* `useInertiaScroll` `target` को एक closure में रखता है जो wheel/key handlers के बीच साझा है।
4. **`map` / `filter` / `reduce`?** Pure array transforms जो नए values लौटाते हैं; `forEach` कुछ नहीं लौटाता।
5. **`null` vs `undefined`?** `undefined` = कभी assign नहीं हुआ; `null` = जान-बूझकर खाली।
6. **TS: `interface` vs `type`?** दोनों shapes बताते हैं; interfaces merge और extend होते हैं, types unions/intersections/mapped types करते हैं।

## Medium
1. **Event loop समझाइए।** Call stack → microtask queue (promises, `queueMicrotask`) पूरी तरह खाली होती है → एक macrotask (timers, I/O, events) → render → दोहराएँ। `await` एक microtask के रूप में आगे बढ़ता है। नतीजा: कभी न ख़त्म होने वाली microtask chain rendering को भूखा रखती है।
2. **`this` कैसे काम करता है?** यह call-site से तय होता है: method call, `call/apply/bind`, `new`, default (strict mode में undefined)। Arrow functions lexical `this` capture करते हैं।
3. **Debounce vs throttle — debounce implement कीजिए।**
   ```ts
   const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
     let t: ReturnType<typeof setTimeout>;
     return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
   };
   ```
4. **Promise combinators।** `all` (जल्दी fail होता है), `allSettled` (कभी reject नहीं होता), `race` (settle होने वाला पहला), `any` (fulfil होने वाला पहला)। जानें कि "सब load करो या fail" बनाम "best effort" के लिए कौन सा इस्तेमाल करना है।
5. **Prototype chain और `class`।** Classes prototypes के ऊपर syntax हैं; method lookup `__proto__` पर चलता है। *यहाँ:* editor engine और backend classes ES classes इस्तेमाल करते हैं — देखें `docs/OOP_ARCHITECTURE.md`।
6. **TS generics और narrowing।** Discriminated unions + `never` check के साथ exhaustive `switch`। *यहाँ:* `ReadingContext` actions `type` पर एक discriminated union हैं।
7. **TS `let x: T | null = null` को `null` तक narrow क्यों करता है?** Control-flow analysis सिर्फ़ assignment देखता है, closure के writes नहीं — `null as T | null` से cast करें (`formatCode.ts` में ठीक किया गया)।

## Hard
1. **`Promise.all` / concurrency N वाला promise pool implement कीजिए।** एक index रखें और N workers हर एक अगला task उठाए; सब settle होने पर resolve करें; index के हिसाब से results का क्रम बनाए रखें।
2. **SPAs में memory leaks।** Detached DOM nodes, न हटाए गए listeners/intervals, बड़े objects थामे रखने वाले closures, unbounded caches। पहचान: heap snapshots, "detached" filter। *यहाँ:* हर `useEffect` जो listener/`requestAnimationFrame` जोड़ता है, एक cleanup लौटाता है।
3. **Deep clone / deep equal के edge cases।** Cycles (WeakMap), Dates, Maps/Sets, property descriptors, `structuredClone` की सीमाएँ (functions नहीं)।
4. **TS advanced types।** `DeepReadonly<T>`, value type के आधार पर `Pick`, एक typed `EventEmitter<Events>` बनाइए; variance, `infer`, template-literal types समझाइए।
5. **Module systems।** ESM (static, live bindings, tree-shakable) बनाम CJS (dynamic, copies); dual-package hazards; Next को `"use client"` boundaries की ज़रूरत क्यों है।
6. **Rich-text editor के लिए undo/redo stack design कीजिए।** Command pattern + typing bursts की coalescing + selection snapshots। *यहाँ:* `lib/editor/**` में dependency-free editor।
