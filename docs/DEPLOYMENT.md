# Deployment

## Requirements
Node.js 18.17+ (20 recommended, see `.nvmrc`), npm 9+.

## Environment
| Variable | When | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **build time** | Backend base URL incl. `/api/v1`. Empty = standalone frontend. See `.env.production.example`. |

`NEXT_PUBLIC_*` values are baked into the bundle, so change them → rebuild.

## Build and run (any Linux server)
```bash
npm ci
npm run typecheck && npm test      # gates
npm run build
npm start                          # serves on :3000 (PORT=… to change), binds 0.0.0.0
```
Keep it alive with systemd or PM2 (`pm2 start npm --name speed-reader -- start`) behind nginx/Caddy that terminates TLS and proxies to `127.0.0.1:3000`.

## Docker
```bash
docker build -t speed-reader --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 .
docker run -d -p 3000:3000 --restart unless-stopped speed-reader
```
Multi-stage, non-root, with a healthcheck.

## nginx (example)
```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

## Landing video
Put your file at `public/videos/landing-hero.mp4` (optional `.webm` + `landing-hero-poster.jpg`). Served with a long-lived cache header; rename the file when you replace it so browsers refetch.

## Conventions that keep the build green
- **CSS:** plain `.css` files are imported **only in `app/layout.tsx`** (Next.js rejects global CSS imported from components). New component styles: use Tailwind, or a `Name.module.css` imported by the component.
- Browser-only reads (`localStorage`, `window`) happen in `useEffect`, never during render, to avoid hydration mismatches.
- Hook/browser files start with `"use client"`.
- Lint runs in CI (`npm run lint`), not during `next build`.

## Smoke test after deploy
`/` (hero, carousel, sections) · `/dashboard` · open a story → `/reader` · reading mode → `/read` · sign-in · theme switch · 404 page (`/nope`).

## Security headers
Set in `next.config.js` (nosniff, frame options, referrer policy, permissions policy with microphone allowed for voice search). Add HSTS at the proxy once HTTPS is final.

## PDF support (pdf.js)
`next build` fails with "failed to parse input file / Syntax Error" if pdf.js's modern build or worker goes through the SWC minifier. So: the app imports `pdfjs-dist/legacy/build/pdf.mjs` (pinned to 4.4.168) and loads the worker from `/pdf.worker.min.mjs`, which `scripts/copy-pdf-worker.mjs` copies into `public/` automatically before `npm run dev` and `npm run build`. After upgrading pdfjs-dist, just rebuild.

## Troubleshooting
- **`Cannot find module '.next/server/middleware-manifest.json'` and every page is a 500:** a stale `.next` folder (usually left by a failed `npm run build`) is being reused by `next dev`. `npm run dev` now clears it automatically; manually: stop the server, `rm -rf .next`, start again.
- Use Node 20 LTS (`nvm use`), and keep the project in a folder path without spaces or brackets (not `speed-reader-frontend (3)`); both avoid odd dev-server failures.

## Browser storage used by the app
`localStorage` (stories, history, per-user sessions, theme settings), IndexedDB `speed-reader-media` (story hover videos) and `speed-reader-backgrounds` (landing theme uploads). Nothing is sent to a server unless `NEXT_PUBLIC_API_URL` is set.
