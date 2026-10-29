# Vercel deployments versus the domain

## Question
Why did a specific deployment URL not show the update while the main domain did?

## Findings
- Every deploy gets its own permanent URL (like `pacewise-xxxx.vercel.app`) showing ==exactly that build==.
- The production domain always points at the latest *production* deployment.
- A deployment can be Ready but not promoted, or built from a branch, so its URL and the domain can differ.
- Deployment URLs may also be protected by Vercel authentication, so they can look "not available" to visitors.

## Decision
Share the production domain (and use it in the QR code); treat deployment URLs as per-build previews.
