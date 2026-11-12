# Docs refinement plan (needs approval)

Nothing in this list has been applied. Every item edits an **existing** file, so each waits for your go-ahead. Nothing is deleted: stubs are replaced by real content, and other edits only add or correct lines. Every English change gets the same change in its `.hi.md` twin, so `node scripts/check-hi-docs.mjs` keeps passing.

Already done without approval (new files only, nothing existing touched):

- `docs/architecture/README.md` + `.hi.md`
- `docs/architecture/01-folder-and-component-map.md` + `.hi.md`
- `docs/architecture/02-data-flows.md` + `.hi.md`
- `docs/architecture/03-design-patterns-and-trade-offs.md` + `.hi.md`
- `docs/architecture/04-cs-fundamentals-by-component.md` + `.hi.md`
- `docs/architecture/05-api-design-rest-graphql-grpc.md` + `.hi.md`
- `docs/architecture/06-performance-testing-and-reliability.md` + `.hi.md`
- `docs/architecture/07-scaling-to-100m-users.md` + `.hi.md`
- `docs/architecture/08-jd-consumer-product-engineering.md` + `.hi.md` (moved out of `docs/interview/`: that section is only for your system design solutions)
- `docs/research/06-world-engineering-references.md` + `.hi.md`

---

## A. Step needed to show the new pages on the docs website

| # | Command / file | What changes | Why approval is needed |
|---|---|---|---|
| A1 (DONE, approved) | `node scripts/build-docs.mjs` | Regenerates `lib/docs/generated.ts`, `lib/docs/index.generated.ts`, `lib/docs/search.generated.ts` | These are `.ts` files under `lib/`. Until this runs, the new pages exist only as Markdown and **do not appear on the website**. No hand-written code changes. |
| A2 (optional) | `lib/docs/library.ts` → `FOLDER_LABELS`, and `lib/docs/i18n.ts` → `FOLDER_LABELS_HI` | Add `architecture: "Architecture"` and `architecture: "आर्किटेक्चर"` | Without it the menu already auto-labels the folder "Architecture" in both languages. Only needed if you want the Hindi menu label in Hindi. This is a code edit, so it is optional. |

## B. Stub pages to fill (currently say "Content ... will be added here")

| # | File (and its `.hi.md`) | Current content | Proposed content |
|---|---|---|---|
| B1 | `docs/syllabus/04-cn-os-oops-dbms-utilization.md` | 3-line stub titled "Core CSE" (it is the first row of the Syllabus menu) | Short overview: one paragraph per subject (CN, OS, DBMS, OOP) saying what Pacewise uses it for; a 4×3 table linking the 12 existing pages `04-core-cse/{cn,os,dbms,oops}/{01-frontend,02-express-backend,03-flask-backend}.md`; a link to `../architecture/04-cs-fundamentals-by-component.md` for the per-component view. Keep the `# Core CSE` title. |
| B2 | `docs/syllabus/03-methodologies/01-tools-and-technology.md` | 3-line stub | Stack table from `package.json` with exact versions and the reason for each: Next.js 14.2.5 (App Router), React 18.3, TypeScript 5.5 strict, Tailwind 3.4, framer-motion, Recharts, react-big-calendar, pdfjs-dist 4.4.168 (pinned on purpose), pdf-lib, JSZip, styled-components (loaders only), lucide-react. Tooling: `tsx` unit tests, ESLint, Docker multi-stage, Vercel (frontend), Render (backend), Google Identity Services. A column "alternative considered" (for example Redux vs reducer, React Query vs local-first). |
| B3 | `docs/syllabus/05-challenges.md` | 3-line stub | Problem → cause → fix → lesson table: Render free tier blocks SMTP (OTP mails fail; fix: HTTPS e-mail API); backend cold start (health ping + status toast); parallel 401 refresh race (single-flight); one user's data showing for the next (UserNamespace + SessionBoundary); progress % jumping on font change (progress as source of truth); hydration mismatch (empty first paint, hydrate in effect); clicks feeling slow (synchronous `localStorage` snapshot); sync echo loop (`touchQuiet`); pdf.js worker version mismatch (pinned version + copy script); `metadataBase` pointing at the backend host (SEO/OG URLs). |
| B4 | `docs/syllabus/08-insights.md` | 3-line stub | 10 to 12 short insights learned from building this, each one line plus the file that proves it (for example "derive, don't store: streaks from active days", "ownership checked twice: client saves bandwidth, server enforces", "measure time, don't count ticks"). |
| B5 | `docs/syllabus/07-research-references.md` | 3-line stub (hidden from the menu by `HIDDEN_IN_MENU`) | Reference list (titles and public URLs only, no copied text): MDN (Fetch, EventSource, Page Visibility, IndexedDB, `useSyncExternalStore` in React docs), web.dev Core Web Vitals, RFC 6749 (OAuth 2.0), RFC 7519 (JWT), OAuth 2.0 Security BCP (refresh-token rotation), Google Identity Services docs, Next.js App Router docs, pdf.js, Mermaid, *Designing Data-Intensive Applications* (replication, idempotency). |

## C. Accuracy fixes in existing pages

| # | File (and its `.hi.md`) | Exact place | Change | Reason (verified in code) |
|---|---|---|---|---|
| C1 | `docs/DEPLOYMENT.md` | Section `## Environment`, the `NEXT_PUBLIC_API_URL` row and the line below it | Add a note: the backend URL is currently written directly in `lib/api/config.ts` (`API_BASE_URL`), so `NEXT_PUBLIC_API_URL` is not read; to change backend, edit that constant and rebuild. Keep the existing row. | `lib/api/config.ts` line 11 hard-codes the URL; commit `1922746` removed the env read. |
| C2 | `docs/DEPLOYMENT.md` | Section `## Troubleshooting` (append) | Add: "Render free web services block outbound SMTP (ports 25/465/587). Google sign-in still works (HTTPS); e-mail OTP verify/reset needs an HTTPS e-mail API (Resend, Brevo, SendGrid, Mailgun)." and "First request after idle can take 30 to 50 s (cold start); the sign-in page shows Backend connected / not connected." | Found during this session. |
| C3 | `docs/syllabus/04-core-cse/cn/01-frontend.md` | Table row "Live notifications" | Append "(hook is ready; not yet mounted, so the bell currently updates through the 15 s poll)". | `useNotificationStream` has no caller; `NotificationBell` reads `devDataStore`. |
| C4 | `docs/syllabus/04-core-cse/oops/01-frontend.md` | Table row `ScopedTokenStore` | "Keeps tokens separate for each demo user" → "Keeps tokens separate for each signed-in user". | Tokens are scoped to whoever `sessionManager.activeUserId()` returns (real accounts too). |
| C5 | `docs/syllabus/04-core-cse/dbms/01-frontend.md` | Bullet "Cascade" | Append "and its direct replies". | `deleteComment` also removes child comments and their reactions. |
| C6 | `docs/interview/06-backend-apis-databases.md` | Hard question 3 ("N+1 queries. Prisma ...") | Add a line that the current backend uses MongoDB, so the MongoDB answer is `$lookup` / batched `$in` queries / DataLoader; keep the Prisma answer as the SQL variant. | The sync, tracking and DBMS pages describe MongoDB. **Please confirm** which ORM/driver the backend uses before this is applied. |

## D. Links from existing index pages to the new pages

| # | File (and its `.hi.md`) | Exact place | Change |
|---|---|---|---|
| D1 | `docs/research/README.md` | The bullet list of notes | Add a bullet: "[World engineering references](06-world-engineering-references.md): papers, specs and engineering blogs behind each Pacewise idea". Same in `README.hi.md`. (The earlier idea of linking from `docs/interview/README.md` is withdrawn.) |
| D2 | `docs/syllabus/README.md` | Last line "For related material see the **Research** section." | Append: "For architecture, data flows, patterns and scaling see [Architecture overview](../architecture/README.md)." Same link in `README.hi.md`. |
| D3 | `docs/OOP_ARCHITECTURE.md` | End of section `## 7. Design patterns used` | Append one line: "Full catalogue across the whole frontend, with trade-offs: [Design patterns and trade-offs](architecture/03-design-patterns-and-trade-offs.md)." Same link in `.hi.md`. |
| D4 | `docs/research/00-pacewise-research-readme.md` | Section `## 4. What was built (by area)` (append a bullet) | "Architecture docs: component map, data flows, patterns, CS fundamentals, API design, performance, scaling: [Architecture overview](../architecture/README.md)." Same in `.hi.md`. |

## E. Not proposed (left exactly as they are)

- All DAA notes, leadership principles, flip-book, text editor, time analysis, landing themes, story page, quiz pages and their Hindi versions.
- Every `.tsx`, `.ts`, `.css` file, design tokens, layout and styles. The only code-adjacent items are A1 (generated bundles) and the optional A2.

## How to approve

Reply with the item numbers, for example "A1, B1-B4, C1-C5, D1-D2". Items are independent; any subset can be applied.
