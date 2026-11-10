# 09 · Behavioral और Project Walkthrough

इस level पर behavioral rounds किसी अन्यथा मज़बूत loop को भी reject करवा सकते हैं। **STAR** का उपयोग करें, result से शुरू करें, संख्याओं में बताएँ, और *अस्पष्टता में judgement* दिखाएँ।

## Easy
1. अपने बारे में बताइए (90 seconds: आप कौन हैं → आपने क्या बनाया → आगे क्या चाहते हैं)।
2. यही company/role क्यों?
3. आपका पसंदीदा project और क्यों।

## Medium
1. **Speed Reader को शुरू से अंत तक समझाइए।** Problem (लोग धीरे पढ़ते हैं और कम याद रखते हैं) → solution (timed reader + quiz + analytics) → architecture (Next.js 14, per-user session layer, dependency-free rich editor, Express/Prisma backend) → कठिन समस्याएँ → results।
2. **सबसे कठिन technical problem।** जैसे code formatter: language-agnostic, idempotent, strings/comments को कभी न बदलने वाला, collapsed single-line code को संभालने वाला; या inertia scrolling जो inner scrollers को रास्ता देती है।
3. **Teammate से असहमति।** पहले data, disagree-and-commit, नतीजा।
4. **आपका ship किया हुआ bug।** ज़िम्मेदारी लें; root cause (जैसे footer का fixed page के ऊपर painting करना); रोकथाम (route-level guard + test)।
5. **Deadlines के साथ prioritisation** (hackathons: DispatchHub, CredMatch)।

## Hard
1. **Project के बीच में direction बदलने का समय।** जैसे paste-as-code change को rollback करना जब उससे regressions आए; आपने कैसे निर्णय लिया और कैसे communicate किया।
2. **बिना authority के lead करना / mentoring।**
3. **अधूरे data के साथ निर्णय लिया और वह गलत निकला।**
4. **Scope से आगे ownership** (CI/Docker, docs, tests सेट करना जो किसी ने नहीं माँगे थे)।
5. **Bar ऊँचा उठाना:** आप किसी team में engineering quality कैसे सुधारेंगे — review standards, tests, docs, on-call hygiene।

## Project talking points (3 levels गहराई तक जाने के लिए तैयार रहें)
- **Per-user isolation:** namespaced storage + remount boundary; legacy keys को अपनाने का test किया गया।
- **Editor:** अपना tokenizer/sanitiser/code widget; library क्यों नहीं (bundle size, control), किस पर दोबारा विचार करेंगे (CRDT collaboration)।
- **Reading mode:** scroll से स्वतंत्र real-time clock, जल्दी खत्म करने पर WPM की दोबारा गणना, ≤5 ticks वाली rail।
- **जो trade-offs आपने स्वीकार किए:** localStorage-first persistence, backend optional (`NEXT_PUBLIC_API_URL` खाली = standalone)।
- **आगे आप क्या करेंगे:** असली teams/shared docs (OT/CRDT), server-side search, e2e tests, a11y audit।
