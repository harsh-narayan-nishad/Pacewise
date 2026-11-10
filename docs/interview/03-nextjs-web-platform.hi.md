# 03 · Next.js और Web Platform

## Easy
1. **App Router vs Pages Router?** `app/` nested layouts, default में Server Components, `loading/error/not-found` conventions इस्तेमाल करता है; `pages/` `getServerSideProps` आदि इस्तेमाल करता है।
2. **`"use client"` क्या है?** किसी module (और उसके imports) को client bundle का हिस्सा चिह्नित करता है; hooks, browser APIs, event handlers के लिए ज़रूरी है।
3. **CSS box model; `position` values?** content/padding/border/margin; static, relative, absolute, fixed, sticky।
4. **Flexbox vs Grid?** Flex = एक dimension; Grid = दो।
5. **`next build` क्या करता है?** Compile करता है, type-check करता है, जो हो सके उसे statically render करता है, `.next` बनाता है।

## Medium
1. **Component में plain `.css` import करने पर error क्यों आता है?** Next.js सिर्फ़ *global* (non-module) CSS को root layout (और Pages में `_app`) से import करने देता है। कहीं और build उसे reject कर देता है ताकि global CSS का क्रम predictable रहे। Fixes: (a) `app/layout.tsx` में import करें (यह project यही करता है, `globals.css` के बाद एक तय क्रम में), (b) `*.module.css` इस्तेमाल करें, (c) Tailwind utilities। **यहाँ का नियम: components कभी `.css` import नहीं करते।**
2. **Rendering modes।** SSG, SSR, ISR, CSR, streaming; कब कौन सा चुनें (SEO + freshness + cost)।
3. **App Router में data fetching और caching।** `fetch` caching, `revalidate`, `cache: "no-store"`, route segment config, `revalidatePath/Tag`।
4. **Core Web Vitals।** LCP (सबसे बड़ी image/text — hero को preload करें, fonts optimise करें), INP (long tasks — काम बाँटें, `startTransition`), CLS (images/fonts के लिए जगह reserve करें)।
5. **Specificity और stacking contexts।** *यहाँ:* एक positioned footer एक `fixed` page के ऊपर painted हो गया जिसमें कोई in-flow content नहीं था, और `/reader` छिप गया; fix यह था कि उस route पर footer render ही न किया जाए।
6. **Tailwind के pros/cons।** CSS variables (`rgb(var(--ink))`) से design tokens classes दोहराए बिना तीन themes संभव बनाते हैं; purge CSS को छोटा रखता है; कमी: लंबी class strings → components निकालें।
7. **`env` handling।** सिर्फ़ `NEXT_PUBLIC_*` browser तक पहुँचता है और **build time पर** inline हो जाता है; server secrets को वह prefix कभी नहीं मिलता।

## Hard
1. **URL टाइप करने से pixels तक क्या होता है, समझाइए।** DNS, TCP/TLS, HTTP/2-3, HTML parse, preload scanner, CSSOM+DOM → render tree → layout → paint → composite; JS parsing को block करता है जब तक `async/defer/module` न हो।
2. **Marketing page को Lighthouse पर 95+ दिलाइए।** `font-display` के साथ fonts को self-host/subset करें, `next/image`, fold के नीचे के video को lazy load करें (`preload="none"`/IntersectionObserver), layout shift से बचें, third-party scripts को defer करें, cache headers (देखें `next.config.js`)।
3. **हर चीज़ को hijack किए बिना smooth inertia scrolling बनाइए।** Wheel/keys पर एक target को हिलाएँ, असली `scrollTop` को rAF lerp से ease करें, inner scrollers, fixed overlays, dialogs, touch, reduced motion के लिए **एक तरफ़ हट जाएँ**। *यहाँ:* `useInertiaScroll`।
4. **CSP, CORS और security headers।** जानें कि हर एक क्या block करता है; voice search के लिए `Permissions-Policy: microphone=(self)` क्यों ज़रूरी है; CSP के साथ inline styles के trade-offs।
5. **Hydration और streaming की गहरी समझ।** Suspense boundaries HTML stream करती हैं; selective hydration उन regions को प्राथमिकता देता है जिनसे interact हुआ; browser-only reads effects में क्यों होने चाहिए।
6. **बड़े CSS codebase को सुरक्षित तरीके से migrate कीजिए।** Codemods, visual regression tests, strangler approach, पहले colours को tokenise करें।
