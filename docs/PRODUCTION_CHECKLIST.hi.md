# Production checklist

नीचे दी गई किसी भी चीज़ से behaviour नहीं बदलता; ये safety, quality और operability के उपाय हैं।

## Repo में
- **Security headers** (`next.config.js`): nosniff, frame-options, referrer policy, permissions policy, HSTS, COOP; `X-Powered-By` हटाया गया।
- **Error handling**: `app/error.tsx` (route errors), `app/global-error.tsx` (layout errors), `app/not-found.tsx`।
- **Metadata**: title template, Open Graph, viewport/theme colour, `NEXT_PUBLIC_SITE_URL` से `metadataBase`; `app/robots.ts` account pages को search से बाहर रखता है।
- **Accessibility**: skip-to-content link और एक `<main>` landmark; icon buttons में `aria-label` हैं।
- **Dead code हटाया गया**: अनुपयोगी `ThumbnailPicker` और `ReadingModeToggle`।
- **CI** (`.github/workflows/ci.yml`): हर PR पर typecheck → lint → tests → build। Locally: `npm run check`।
- **Editor settings**: `.editorconfig`।

## Go-live से पहले (आपके infrastructure की ज़रूरत है)
1. `NEXT_PUBLIC_SITE_URL` और API base URL set करें (`.env.production.example`)।
2. HTTPS पर serve करें (HSTS चालू है); `/_next/static` और `/videos` के आगे CDN लगाएँ।
3. Dev login/dev store को असली backend auth से बदलें (देखें `docs/DEPLOYMENT.md`)।
4. अपने hosts के विरुद्ध test करने के बाद Content-Security-Policy जोड़ें (Google Fonts अकेला third-party origin है)।
5. `app/error.tsx` / `app/global-error.tsx` में error monitoring (जैसे Sentry) जोड़ें।
6. `npm install` चलाकर lockfile बनाएँ और उसे commit करें; उसके बाद CI में `npm ci` इस्तेमाल करें।
