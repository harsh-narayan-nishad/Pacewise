# 07 · Auth & Security

## Easy
1. **Authentication vs authorisation?**
2. **Hashing vs encryption?** Hashing is one-way (use bcrypt/argon2 with salt); encryption is reversible.
3. **What is XSS / CSRF / SQL injection?** Script injection into pages / forged cross-site requests using the user's cookies / unsanitised input in queries (use parameterised queries).
4. **HTTPS why?** Confidentiality, integrity, server authentication.

## Medium
1. **Session cookies vs JWT.** Cookies (HttpOnly, Secure, SameSite) + server session = easy revocation; JWT = stateless but hard to revoke → short-lived access token + rotating refresh token.
2. **Refresh-token rotation & reuse detection.** Issue new refresh on use, invalidate old; if an old one reappears, revoke the whole family.
3. **OAuth 2.0 / OIDC (Google, Apple, Facebook).** Authorization Code + PKCE; validate `state`, `nonce`, ID-token signature/audience; link accounts by verified email.
4. **OTP login.** Hash OTPs, short TTL, attempt limits, per-identity + per-IP rate limits, constant-time compare.
5. **Sanitising rich text.** Allow-list sanitiser, never `dangerouslySetInnerHTML` unsanitised. *Here:* the editor has its own sanitiser and `safeThumbnail` blocks non-image data URLs.
6. **Per-user data isolation on the client.** *Here:* `lib/session` namespaces storage per user and `SessionBoundary` remounts the tree on user change, tested in `test:session`.

## Hard
1. **Threat-model a login + file-upload service (STRIDE).** Brute force, credential stuffing, token theft, SSRF via URL fetch, zip bombs, content-type confusion, path traversal.
2. **Design secure password reset.** Single-use hashed tokens, expiry, no user enumeration, invalidate sessions after reset.
3. **Where do you store tokens in an SPA?** Memory + HttpOnly refresh cookie beats localStorage (XSS-readable). Discuss BFF pattern.
4. **CSP design.** Nonce-based `script-src`, `frame-ancestors`, report-only rollout.
5. **Supply-chain security.** Lockfiles, `npm ci`, provenance, Dependabot, pin CI actions, least-privilege tokens.
6. **Secrets management & rotation.** Vault/KMS, no secrets in the repo (`.gitignore` excludes `.env*`), short-lived credentials.
