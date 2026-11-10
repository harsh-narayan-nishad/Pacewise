# 08 · Testing, CI/CD और Deployment

## Easy
1. **Unit vs integration vs e2e?** बहुत सारे fast unit tests, उनसे कम integration, और बहुत कम e2e (test pyramid)।
2. **अच्छा test किसे कहते हैं?** Deterministic, isolated, fast, और जो implementation नहीं बल्कि behaviour को test करे।
3. **CI/CD क्या है?**

## Medium
1. **इस repo को कैसे test किया जाता है?** `npm run test:editor` (55 tests: tokenizer, formatter idempotency, sanitiser, reading-mode clock) और `npm run test:session` (21 tests: per-user isolation)। इन्हें `npm test` से चलाएँ।
2. **Property-based / invariant tests।** Tokens को जोड़ने पर source वापस मिलता है; formatter idempotent है; `wpm` की दोबारा गणना elapsed time से मेल खाती है।
3. **Mocking strategy।** Boundaries (network, time) पर mock करें, internals पर नहीं; debounce/rAF के लिए fake timers का उपयोग करें।
4. **Environment config।** Build-time `NEXT_PUBLIC_*` बनाम runtime server env; एक image, कई environments के लिए सिर्फ़ server values का runtime config ज़रूरी है।
5. **Docker multi-stage builds।** Deps → build → slim runtime, non-root user, healthcheck (देखें `Dockerfile`)।

## Hard
1. **Zero-downtime deploys।** Rolling/blue-green/canary, readiness probes, connection draining, backwards-compatible DB migrations।
2. **Feature flags और safe rollout।** Percentage rollouts, kill switch, cleanup debt।
3. **Observability।** Request IDs वाले structured logs, RED metrics, distributed tracing, frontend RUM (web-vitals), Sentry में source maps, raw errors पर नहीं बल्कि SLO burn rate पर alert।
4. **Rollback strategy।** Immutable artefacts, DB expand/contract ताकि N-1 अब भी काम करे, deploy के बाद automated smoke test।
5. **Flaky e2e को test करना।** Network isolation, stable selectors (roles/labels), timeouts पर नहीं बल्कि conditions पर wait, quarantine + owner।
6. **CI में performance budget।** Lighthouse CI, bundle-size limits, regression होने पर PR को fail करना।

## इस project के लिए release checklist
`npm ci` → `npm run typecheck` → `npm test` → `npm run lint` → `npm run build` → smoke `npm start` → `/`, `/dashboard`, `/reader`, `/read` के load होने की जाँच करें। देखें `docs/DEPLOYMENT.md`।
