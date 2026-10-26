# Production checklist

Behaviour is unchanged by everything below; these are safety, quality and operability measures.

## In the repo
- **Security headers** (`next.config.js`): nosniff, frame-options, referrer policy, permissions policy, HSTS, COOP; `X-Powered-By` removed.
- **Error handling**: `app/error.tsx` (route errors), `app/global-error.tsx` (layout errors), `app/not-found.tsx`.
- **Metadata**: title template, Open Graph, viewport/theme colour, `metadataBase` from `NEXT_PUBLIC_SITE_URL`; `app/robots.ts` keeps account pages out of search.
- **Accessibility**: skip-to-content link and a `<main>` landmark; icon buttons carry `aria-label`s.
- **Dead code removed**: unused `ThumbnailPicker` and `ReadingModeToggle`.
- **CI** (`.github/workflows/ci.yml`): typecheck → lint → tests → build on every PR. Locally: `npm run check`.
- **Editor settings**: `.editorconfig`.

## Before go-live (needs your infrastructure)
1. Set `NEXT_PUBLIC_SITE_URL` and the API base URL (`.env.production.example`).
2. Serve over HTTPS (HSTS is on); put a CDN in front of `/_next/static` and `/videos`.
3. Replace the dev login/dev store with the real backend auth (see `docs/DEPLOYMENT.md`).
4. Add a Content-Security-Policy once tested against your hosts (Google Fonts are the only third-party origin).
5. Add error monitoring (e.g. Sentry) in `app/error.tsx` / `app/global-error.tsx`.
6. Run `npm install` to create a lockfile and commit it; use `npm ci` in CI afterwards.
