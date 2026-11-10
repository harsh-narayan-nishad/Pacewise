# Landing-page themes ("Add theme")

Hamburger menu खोलें → **Add theme**। यह सिर्फ़ landing page के hero का background बदलता है; app में और कुछ नहीं।

| Theme | यह क्या है |
|---|---|
| Dots (default) | झिलमिलाता dot grid (mouse interaction नहीं)। |
| Grainient | `components/ui/Grainient.tsx` से animation-रहित WebGL gradient, जिसे `components/Landing/LandingBackground.tsx` में configure किया गया है। |
| Your uploads | कोई भी photo (PNG/JPEG/WebP/GIF/AVIF, ≤ 25 MB) या video (MP4/WebM/MOV, ≤ 80 MB)। Videos muted और loop में चलते हैं। Delete करने के लिए tile पर hover करें। |

**Adjustments** (हर theme पर लागू): Contrast 0.5–1.5, Brightness 0.4–1.6, Saturation 0–2, Dim 0–0.8 (text पढ़ने में आसान रहे इसके लिए काला scrim)। "Reset adjustments" neutral values वापस ले आता है।

## चीज़ें कहाँ हैं
- `lib/landingTheme.ts` – चुना गया theme + adjustments, `localStorage` (`speed-reader.landing-theme.v1`) में सेव; `useLandingTheme()` menu और landing page को sync में रखता है।
- `lib/landingMedia.ts` – अपलोड की गई files, IndexedDB (`speed-reader-backgrounds`) में stored।
- `components/Navigation/ThemePanel.tsx` – menu का UI। `components/Search/SearchLanding.tsx` – चुना हुआ background render करता है।
- Menu में "Reset everything" सेव किया हुआ theme और uploads भी साफ़ कर देता है।

## Notes
- Grainient को WebGL2 चाहिए; इसके बिना hero सिर्फ़ page का background दिखाता है।
- Defaults मूल dot background को जैसा है वैसा छोड़ते हैं (neutral values पर कोई filter लागू नहीं होता)।
- Grainient theme design से ही dark है; light site theme पर headline पढ़ने लायक रखने के लिए Brightness/Dim इस्तेमाल करें।
