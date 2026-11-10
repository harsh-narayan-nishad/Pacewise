# 07 · Auth & Security

## Easy
1. **Authentication बनाम authorisation?**
2. **Hashing बनाम encryption?** Hashing one-way है (salt के साथ bcrypt/argon2 इस्तेमाल करो); encryption reversible है।
3. **XSS / CSRF / SQL injection क्या हैं?** Pages में script injection / user की cookies इस्तेमाल करके forged cross-site requests / queries में unsanitised input (parameterised queries इस्तेमाल करो)।
4. **HTTPS क्यों?** Confidentiality, integrity, server authentication।

## Medium
1. **Session cookies बनाम JWT।** Cookies (HttpOnly, Secure, SameSite) + server session = आसान revocation; JWT = stateless लेकिन revoke करना कठिन → short-lived access token + rotating refresh token।
2. **Refresh-token rotation & reuse detection।** इस्तेमाल पर नया refresh जारी करो, पुराने को invalidate करो; अगर कोई पुराना दोबारा दिखे, तो पूरी family revoke करो।
3. **OAuth 2.0 / OIDC (Google, Apple, Facebook)।** Authorization Code + PKCE; `state`, `nonce`, ID-token signature/audience validate करो; verified email से accounts link करो।
4. **OTP login।** OTPs को hash करो, छोटा TTL, attempt limits, per-identity + per-IP rate limits, constant-time compare।
5. **Rich text को sanitise करना।** Allow-list sanitiser, unsanitised `dangerouslySetInnerHTML` कभी नहीं। *यहाँ:* editor का अपना sanitiser है और `safeThumbnail` non-image data URLs को block करता है।
6. **Client पर per-user data isolation।** *यहाँ:* `lib/session` हर user के लिए storage को namespace करता है और user बदलने पर `SessionBoundary` पूरे tree को remount करता है, `test:session` में tested।

## Hard
1. **Login + file-upload service का threat-model बनाओ (STRIDE)।** Brute force, credential stuffing, token theft, URL fetch के ज़रिए SSRF, zip bombs, content-type confusion, path traversal।
2. **Secure password reset design करो।** Single-use hashed tokens, expiry, user enumeration नहीं, reset के बाद sessions invalidate करो।
3. **SPA में tokens कहाँ store करोगे?** Memory + HttpOnly refresh cookie, localStorage (XSS से पढ़ा जा सकता है) से बेहतर है। BFF pattern पर चर्चा करो।
4. **CSP design।** Nonce-based `script-src`, `frame-ancestors`, report-only rollout।
5. **Supply-chain security।** Lockfiles, `npm ci`, provenance, Dependabot, CI actions को pin करो, least-privilege tokens।
6. **Secrets management & rotation।** Vault/KMS, repo में कोई secrets नहीं (`.gitignore` `.env*` को exclude करता है), short-lived credentials।
