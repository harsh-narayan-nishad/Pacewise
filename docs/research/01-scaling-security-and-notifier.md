# Scaling, security and the test notifier

## Question
What would it take to run Pacewise with a real backend at large scale, safely, and how should the "take a test / revise" reminder work?

## Findings
- ==State must leave the browser.== Today progress, sessions and stories live in localStorage; a backend needs one source of truth per user, behind an API.
- **Reads dominate.** Story pages and notes are read far more than written, so they suit a CDN plus a cache; user progress is write-heavy and suits a database with per-user partitioning.
- **Security basics** that cost little and prevent most incidents: hashed passwords, short-lived tokens, per-user authorisation on every query, rate limits on login and upload, and input validation on every boundary.
- **Uploads** (PDFs) go straight to object storage with a signed URL; the server stores only metadata and the owner id.
- **Monitoring**: structured logs, request-level metrics (latency, errors), and alerts on error rate rather than on single failures.

## Notifier algorithm
Use spaced repetition: after each test, schedule the next review at an interval that grows when the score is good and shrinks when it is poor.

| Score | Next review |
| --- | --- |
| Below 50% | next day |
| 50–80% | in 3 days |
| Above 80% | in 7 days, then double each time |

A scheduler job picks users whose next-review time has passed and sends one reminder per user, ==never more than one a day==.

## Decision
Keep the current client-side design for now; when adding a backend, move state first, then uploads, then reminders.
