# डिप्लॉयमेंट

## ज़रूरतें
Node.js 18.17+ (20 recommended, देखें `.nvmrc`), npm 9+.

## Environment
| Variable | कब | उद्देश्य |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **build time** | `/api/v1` सहित Backend का base URL। खाली होने का मतलब standalone frontend। देखें `.env.production.example`। |

`NEXT_PUBLIC_*` values bundle में ही बेक हो जाती हैं, इसलिए इन्हें बदलने पर दोबारा build करें।

## Build और run (कोई भी Linux server)
```bash
npm ci
npm run typecheck && npm test      # gates
npm run build
npm start                          # serves on :3000 (PORT=… to change), binds 0.0.0.0
```
इसे systemd या PM2 (`pm2 start npm --name speed-reader -- start`) से चालू रखें, और इसके आगे nginx/Caddy रखें जो TLS terminate करे और `127.0.0.1:3000` पर proxy करे।

## Docker
```bash
docker build -t speed-reader --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 .
docker run -d -p 3000:3000 --restart unless-stopped speed-reader
```
Multi-stage, non-root, healthcheck के साथ।

## nginx (उदाहरण)
```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

## Landing video
अपनी file `public/videos/landing-hero.mp4` पर रखें (optional `.webm` + `landing-hero-poster.jpg`)। इसे लंबे समय वाले cache header के साथ serve किया जाता है; file बदलते समय उसका नाम भी बदलें ताकि browsers उसे दोबारा fetch करें।

## Build को green रखने वाले conventions
- **CSS:** सादी `.css` files **सिर्फ `app/layout.tsx`** में import की जाती हैं (Next.js components से import की गई global CSS को reject कर देता है)। नए component styles के लिए Tailwind इस्तेमाल करें, या component द्वारा import की गई `Name.module.css`।
- Browser-only reads (`localStorage`, `window`) `useEffect` में होती हैं, render के दौरान कभी नहीं, ताकि hydration mismatches न हों।
- Hook/browser files `"use client"` से शुरू होती हैं।
- Lint CI (`npm run lint`) में चलता है, `next build` के दौरान नहीं।

## Deploy के बाद Smoke test
`/` (hero, carousel, sections) · `/dashboard` · कोई story खोलें → `/reader` · reading mode → `/read` · sign-in · theme switch · 404 page (`/nope`)।

## Security headers
`next.config.js` में सेट हैं (nosniff, frame options, referrer policy, voice search के लिए microphone की अनुमति वाली permissions policy)। HTTPS अंतिम होने के बाद proxy पर HSTS जोड़ें।

## PDF support (pdf.js)
अगर pdf.js का modern build या worker SWC minifier से गुज़रता है, तो `next build` "failed to parse input file / Syntax Error" के साथ fail हो जाता है। इसलिए: app `pdfjs-dist/legacy/build/pdf.mjs` import करता है (4.4.168 पर pinned) और worker को `/pdf.worker.min.mjs` से load करता है, जिसे `scripts/copy-pdf-worker.mjs` हर `npm run dev` और `npm run build` से पहले अपने-आप `public/` में copy कर देती है। pdfjs-dist upgrade करने के बाद बस दोबारा build करें।

## Troubleshooting
- **`Cannot find module '.next/server/middleware-manifest.json'` और हर page पर 500:** एक पुराना `.next` folder (आमतौर पर failed `npm run build` से बचा हुआ) `next dev` द्वारा दोबारा इस्तेमाल हो रहा है। `npm run dev` अब उसे अपने-आप साफ़ कर देता है; manually: server बंद करें, `rm -rf .next`, फिर दोबारा शुरू करें।
- Node 20 LTS इस्तेमाल करें (`nvm use`), और project को ऐसे folder path में रखें जिसमें spaces या brackets न हों (`speed-reader-frontend (3)` जैसा नहीं); दोनों से dev-server की अजीब failures से बचाव होता है।

## App द्वारा इस्तेमाल किया जाने वाला Browser storage
`localStorage` (stories, history, per-user sessions, theme settings), IndexedDB `speed-reader-media` (story hover videos) और `speed-reader-backgrounds` (landing theme uploads)। जब तक `NEXT_PUBLIC_API_URL` सेट न हो, server को कुछ नहीं भेजा जाता।
