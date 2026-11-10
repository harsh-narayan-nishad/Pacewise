# Reading status, कुल reading time, theme और uploads

## Reading status (heartbeat)
`lib/readingPresence.ts` WhatsApp के "online" की तरह काम करता है। हर 5 सेकंड में एक heartbeat जाँचता है:
1. व्यक्ति किसी reading surface पर है (story article दिख रहा है, `/read`, या चल रहा `/reader`),
2. tab visible है, और
3. उन्होंने पिछले 60 सेकंड में कुछ किया (scroll, key, pointer, touch)।

सब सही → navbar में घड़ी के बगल में **● Reading** दिखता है और beat अपना बीता हुआ समय user के कुल में जोड़ देती है। कोई भी गलत → अगली beat पर status idle हो जाता है और कुछ नहीं जुड़ता। सोता हुआ laptop ज़्यादा से ज़्यादा दो beats जोड़ता है। Totals हर user के लिए store होते हैं (`speed-reader:reading-time:<userId>`) और profile photo के बगल में दिखते हैं (पूरा text देखने के लिए hover करें)। `components/Session/PresenceTracker.tsx` browser को जोड़ता है; tests: `npm run test:presence`।

## Theme
Default system के light/dark setting को follow करता है और live update होता है। खुद theme चुनना (switch या Settings) याद रखा जाता है और उसके बाद वही चलता है।

## Uploading
- PDF/image upload अब "Add your own story" जैसे ही design वाला modal खोलता है; quiz questions एक-एक करके टाइप किए जा सकते हैं या JSON के रूप में paste / load किए जा सकते हैं।
- Story `.json`, PDF या image को landing page पर drag करना बिल्कुल upload button जैसा काम करता है (यह "Drop to upload" overlay दिखाता है)।

## Story page
Article के नीचे के stats, About, reading-speed card और Start/Bookmark block हटा दिए गए; navbar अब WPM readouts नहीं दिखाता।
