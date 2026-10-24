# 08 · Testing, CI/CD & Deployment

## Easy
1. **Unit vs integration vs e2e?** Many fast unit tests, fewer integration, few e2e (test pyramid).
2. **What makes a test good?** Deterministic, isolated, fast, tests behaviour not implementation.
3. **What is CI/CD?**

## Medium
1. **How is this repo tested?** `npm run test:editor` (55 tests: tokenizer, formatter idempotency, sanitiser, reading-mode clock) and `npm run test:session` (21 tests: per-user isolation). Run with `npm test`.
2. **Property-based / invariant tests.** Tokens re-concatenate to source; formatter is idempotent; `wpm` recalculation matches elapsed time.
3. **Mocking strategy.** Mock at boundaries (network, time), not internals; fake timers for debounce/rAF.
4. **Environment config.** Build-time `NEXT_PUBLIC_*` vs runtime server env; one image, many environments requires runtime config for server values only.
5. **Docker multi-stage builds.** Deps → build → slim runtime, non-root user, healthcheck (see `Dockerfile`).

## Hard
1. **Zero-downtime deploys.** Rolling/blue-green/canary, readiness probes, connection draining, backwards-compatible DB migrations.
2. **Feature flags & safe rollout.** Percentage rollouts, kill switch, cleanup debt.
3. **Observability.** Structured logs with request IDs, RED metrics, distributed tracing, frontend RUM (web-vitals), source maps in Sentry, alert on SLO burn rate not raw errors.
4. **Rollback strategy.** Immutable artefacts, DB expand/contract so N-1 still works, automated smoke test after deploy.
5. **Testing flaky e2e.** Network isolation, stable selectors (roles/labels), waiting on conditions not timeouts, quarantine + owner.
6. **Performance budget in CI.** Lighthouse CI, bundle-size limits, fail the PR on regression.

## Release checklist for this project
`npm ci` → `npm run typecheck` → `npm test` → `npm run lint` → `npm run build` → smoke `npm start` → verify `/`, `/dashboard`, `/reader`, `/read` load. See `docs/DEPLOYMENT.md`.
