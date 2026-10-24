# 03 · Next.js & Web Platform

## Easy
1. **App Router vs Pages Router?** `app/` uses nested layouts, Server Components by default, `loading/error/not-found` conventions; `pages/` uses `getServerSideProps` etc.
2. **What is `"use client"`?** Marks a module (and its imports) as part of the client bundle; needed for hooks, browser APIs, event handlers.
3. **CSS box model; `position` values?** content/padding/border/margin; static, relative, absolute, fixed, sticky.
4. **Flexbox vs Grid?** Flex = one dimension; Grid = two.
5. **What does `next build` do?** Compiles, type-checks, statically renders what it can, emits `.next`.

## Medium
1. **Why does importing plain `.css` in a component error?** Next.js only allows *global* (non-module) CSS to be imported from the root layout (and `_app` in Pages). Anywhere else the build rejects it to keep global CSS order predictable. Fixes: (a) import in `app/layout.tsx` (what this project does, in a fixed order after `globals.css`), (b) use `*.module.css`, (c) Tailwind utilities. **Rule here: components never import `.css`.**
2. **Rendering modes.** SSG, SSR, ISR, CSR, streaming; when to pick each (SEO + freshness + cost).
3. **Data fetching & caching in App Router.** `fetch` caching, `revalidate`, `cache: "no-store"`, route segment config, `revalidatePath/Tag`.
4. **Core Web Vitals.** LCP (largest image/text — preload hero, optimise fonts), INP (long tasks — split work, `startTransition`), CLS (reserve space for images/fonts).
5. **Specificity & stacking contexts.** *Here:* a positioned footer painted over a `fixed` page with no in-flow content, hiding `/reader`; fix was to not render the footer on that route.
6. **Tailwind pros/cons.** Design tokens via CSS variables (`rgb(var(--ink))`) enable three themes without duplicating classes; purge keeps CSS small; drawback: long class strings → extract components.
7. **`env` handling.** Only `NEXT_PUBLIC_*` reaches the browser and is inlined **at build time**; server secrets never get that prefix.

## Hard
1. **Walk through what happens from typing a URL to pixels.** DNS, TCP/TLS, HTTP/2-3, HTML parse, preload scanner, CSSOM+DOM → render tree → layout → paint → composite; JS blocks parsing unless `async/defer/module`.
2. **Make a marketing page score 95+ on Lighthouse.** Self-host/subset fonts with `font-display`, `next/image`, lazy below-the-fold video (`preload="none"`/IntersectionObserver), avoid layout shift, defer third-party scripts, cache headers (see `next.config.js`).
3. **Build smooth inertia scrolling without hijacking everything.** Move a target on wheel/keys, ease real `scrollTop` with rAF lerp, **step aside** for inner scrollers, fixed overlays, dialogs, touch, reduced motion. *Here:* `useInertiaScroll`.
4. **CSP, CORS and security headers.** Know what each blocks; why `Permissions-Policy: microphone=(self)` is needed for voice search; trade-offs of inline styles with CSP.
5. **Hydration & streaming deep dive.** Suspense boundaries stream HTML; selective hydration prioritises interacted regions; why browser-only reads belong in effects.
6. **Migrate a large CSS codebase safely.** Codemods, visual regression tests, strangler approach, tokenise colours first.
