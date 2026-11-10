# 02 · React

## Easy
1. **Props vs state?** Props ऊपर से नीचे बहते हैं और read-only होते हैं; state किसी component की अपनी होती है और बदलने पर re-render trigger करती है।
2. **Lists में `key` क्यों?** Stable identity, ताकि reconciliation सही DOM + state को reuse/move करे। जिन lists का क्रम बदल सकता है उनमें array index कभी इस्तेमाल न करें।
3. **Controlled vs uncontrolled inputs?** Controlled: value state में होती है। Uncontrolled: DOM उसे संभालता है, ref से पढ़ी जाती है।
4. **`useEffect` dependency array?** Deps बदलने पर दोबारा चलता है; `[]` = सिर्फ़ mount/unmount पर। एक cleanup लौटाएँ।
5. **Lifting state up क्या है?** Shared state को सबसे नज़दीकी common parent में ले जाना।

## Medium
1. **`useMemo` / `useCallback` — कब?** सिर्फ़ memoised children/effects के लिए referential stability या महँगी computation के लिए। पहले measure करें; इनमें memory और complexity की लागत होती है।
2. **`useReducer` vs `useState`?** आपस में जुड़े transitions और testable logic के लिए reducer। *यहाँ:* `ReadingContext` एक reducer है (`SET_READING_MODE` को reading/completed के दौरान ignore किया जाता है — एक business rule जो एक ही जगह रहता है)।
3. **Context की दिक्कतें?** Value बदलने पर हर consumer re-render होता है। State/dispatch contexts को अलग करें (यहाँ किया गया है: `useReadingState` / `useReadingDispatch`), values को memoise करें, या selector libraries इस्तेमाल करें।
4. **Dev में effects दो बार क्यों चलते हैं?** StrictMode छूटे हुए cleanups उजागर करने के लिए mount/unmount को दो बार invoke करता है। Effect को ठीक करें, StrictMode को न हटाएँ।
5. **Stale closure bug?** Handler ने पुरानी state value capture कर ली। Functional updates (`setN(n => n+1)`), refs, या सही deps से ठीक करें।
6. **Hydration mismatch के कारण?** Server/client का output अलग होना (`Date.now`, `window`, `localStorage`)। Browser-only data को `useEffect` में पढ़ें। *यहाँ:* `PlatformShowcase` history को render के दौरान नहीं, effect में load करता है।
7. **Error boundaries?** Class/`error.tsx` subtree में render errors पकड़ते हैं (event handlers या async में नहीं)। देखें `app/error.tsx`।

## Hard
1. **Reconciliation, Fiber और concurrent rendering समझाइए।** Fiber काम को interruptible बनाता है; transitions updates को low-priority चिह्नित करते हैं; `useDeferredValue`/`startTransition` input को responsive रखते हैं; renders pure होने चाहिए क्योंकि उन्हें दोहराया/छोड़ा जा सकता है।
2. **10k-row list को optimise कीजिए।** Virtualise (windowing), rows को memoise, stable keys, inline object props से बचें, state को नीचे ले जाएँ, updates को batch करें, `content-visibility` इस्तेमाल करें।
3. **rAF loop को सुरक्षित रूप से चलाने वाला custom hook design कीजिए।** Mutable state को refs में रखें, एक ही `requestAnimationFrame` chain, unmount पर cancel, `prefers-reduced-motion` का सम्मान, hidden होने पर pause। *यहाँ:* `useInertiaScroll`, `useReadingEngine`।
4. **Server Components vs Client Components।** RSC server पर render होते हैं, JS नहीं भेजते, state/effects इस्तेमाल नहीं कर सकते; client components hydrate होते हैं। `"use client"` को leaves तक धकेलें; server data को props के रूप में नीचे भेजें।
5. **बड़े पैमाने पर state management।** Server cache (React Query/SWR) बनाम UI state बनाम URL state बनाम form state; हर चीज़ के लिए एक global store से बचें।
6. **Accessible custom widget।** Roles, keyboard map, focus management/trapping, `aria-live`; *यहाँ:* scroll rail labels वाले buttons इस्तेमाल करती है; carousel buttons में `aria-label`s और disabled states हैं।
