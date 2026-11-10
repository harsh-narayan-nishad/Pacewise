# 11 — Ownership, routing और profile photos (Easy / Medium / Hard)

इस change set के बारे में ~₹2.5 Cr band का interviewer जो प्रश्न पूछ सकता है। पहले उत्तर को ढक लें।

## Easy
1. **String literals की जगह `routes.ts` constant क्यों?** बदलने/grep करने के लिए एक ही जगह, typed helpers (`story(id)`), कोई dead links नहीं।
2. **सिर्फ़ state की जगह `/story/[id]` क्यों?** Refresh, share और back-button काम करते हैं; URL ही source of truth है।
3. **Avatar को store करने से पहले downscale क्यों करें?** localStorage लगभग 5 MB का और synchronous होता है; 256px JPEG ≈ 15 KB।

## Medium
4. **एक user ने अपने upload का "owner" किसी और को देखा — root cause क्या है?** Authorship content id का hash थी। Fix: इसे वहाँ से निकालें जहाँ data रहता है (uploader की library), और hash सिर्फ़ built-ins के fallback के रूप में रखें।
5. **Owner resolver को inject क्यों करें?** `contentMeta ← store ← session`: contentMeta से session import करने पर cycle बनता है। Dependency inversion modules को acyclic और testable रखता है।
6. **Edit modal का reuse — trade-offs?** Shared form parts drift हटाते हैं; कीमत यह है कि दोनों modals एक layout से जुड़ जाते हैं। Parts को presentational रखें।
7. **Image uploads को validate कैसे करें?** Client-side MIME + size check, canvas के ज़रिए re-encode (payloads हट जाते हैं), और सिर्फ़ हमारे अपने format से मेल खाने वाले data URLs render करें (`safeAvatar`)।

## Hard
8. **इसे production में ले जाएँ — क्या बदलेगा?** `authorId` एक DB foreign key बन जाएगा जो session से server-side set होगा (client कभी नहीं देगा); avatars signed uploads के साथ object storage + CDN में जाएँगे; हर mutation पर authorization जाँची जाएगी।
9. **Edit/delete पर IDOR?** Client gating (`isCustomStory`) सिर्फ़ UX है; API को `story.ownerId === session.userId` verify करना ही होगा।
10. **दो tabs एक ही story edit करें — क्या होगा?** आज last write wins है; fix: version/ETag और optimistic concurrency (409 → merge UI)।
11. **Orphaned media (IndexedDB में cover videos)?** Replace/delete पर save commit होने के बाद ही delete करें; एक periodic sweep उन refs को हटाता है जिन्हें कोई story नहीं पकड़े हुए है।
