# 09 · Behavioral & Project Walkthrough

At this level, behavioral rounds can veto an otherwise strong loop. Use **STAR**, lead with the result, quantify, and show *judgement under ambiguity*.

## Easy
1. Tell me about yourself (90 seconds: who you are → what you built → what you want next).
2. Why this company/role?
3. Your favourite project and why.

## Medium
1. **Walk through Speed Reader end to end.** Problem (people read slowly and retain little) → solution (timed reader + quiz + analytics) → architecture (Next.js 14, per-user session layer, dependency-free rich editor, Express/Prisma backend) → hard problems → results.
2. **Hardest technical problem.** E.g. the code formatter: language-agnostic, idempotent, never alters strings/comments, handles collapsed single-line code; or inertia scrolling that yields to inner scrollers.
3. **Disagreement with a teammate.** Data first, disagree-and-commit, outcome.
4. **A bug you shipped.** Own it; root cause (e.g. footer painting over a fixed page); prevention (route-level guard + test).
5. **Prioritisation with deadlines** (hackathons: DispatchHub, CredMatch).

## Hard
1. **A time you changed direction mid-project.** E.g. rolled back the paste-as-code change when it caused regressions; how you decided and communicated.
2. **Led without authority / mentored.**
3. **Made a decision with incomplete data and it was wrong.**
4. **Ownership beyond scope** (set up CI/Docker, docs, tests no one asked for).
5. **Raise the bar:** how you'd improve engineering quality on a team — review standards, tests, docs, on-call hygiene.

## Project talking points (be ready to go 3 levels deep)
- **Per-user isolation:** namespaced storage + remount boundary; tested adoption of legacy keys.
- **Editor:** own tokenizer/sanitiser/code widget; why not a library (bundle size, control), what you'd reconsider (CRDT collaboration).
- **Reading mode:** real-time clock independent of scroll, WPM recalculated on early finish, rail of ≤5 ticks.
- **Trade-offs you accepted:** localStorage-first persistence, backend optional (`NEXT_PUBLIC_API_URL` empty = standalone).
- **What you'd do next:** real teams/shared docs (OT/CRDT), server-side search, e2e tests, a11y audit.
