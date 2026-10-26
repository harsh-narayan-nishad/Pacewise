# 11 — Ownership, routing & profile photos (Easy / Medium / Hard)

Questions an interviewer at the ~₹2.5 Cr band could ask about this change set. Cover the answer first.

## Easy
1. **Why a `routes.ts` constant instead of string literals?** One place to change/grep, typed helpers (`story(id)`), no dead links.
2. **Why `/story/[id]` rather than state-only?** Refresh, share and back-button work; the URL is the source of truth.
3. **Why downscale an avatar before storing?** localStorage is ~5 MB and synchronous; 256px JPEG ≈ 15 KB.

## Medium
4. **A user saw someone else as the "owner" of their upload — root cause?** Authorship was a hash of the content id. Fix: derive it from where the data lives (the uploader's library) with the hash only as a fallback for built-ins.
5. **Why inject the owner resolver?** `contentMeta ← store ← session`: importing session from contentMeta creates a cycle. Dependency inversion keeps modules acyclic and testable.
6. **Edit modal reuse — trade-offs?** Shared form parts remove drift; the cost is coupling both modals to one layout. Keep parts presentational.
7. **Validate image uploads how?** MIME + size check client-side, re-encode through canvas (strips payloads), render only data URLs matching our own format (`safeAvatar`).

## Hard
8. **Move this to production — what changes?** `authorId` becomes a DB foreign key set server-side from the session (never client-supplied); avatars go to object storage + CDN with signed uploads; authorization checked on every mutation.
9. **IDOR on edit/delete?** Client gating (`isCustomStory`) is UX only; the API must verify `story.ownerId === session.userId`.
10. **Two tabs edit the same story — what happens?** Last write wins today; fix with a version/ETag and optimistic concurrency (409 → merge UI).
11. **Orphaned media (cover videos in IndexedDB)?** Delete on replace/delete only after the save commits; a periodic sweep removes refs no story holds.
