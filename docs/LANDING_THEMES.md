# Landing-page themes ("Add theme")

Open the hamburger menu → **Add theme**. It changes the background of the landing page hero only; nothing else in the app.

| Theme | What it is |
|---|---|
| Dots (default) | The twinkling dot grid (no mouse interaction). |
| Grainient | Animated-free WebGL gradient from `components/ui/Grainient.tsx`, configured in `components/Landing/LandingBackground.tsx`. |
| Your uploads | Any photo (PNG/JPEG/WebP/GIF/AVIF, ≤ 25 MB) or video (MP4/WebM/MOV, ≤ 80 MB). Videos play muted and looping. Hover a tile to delete it. |

**Adjustments** (apply to every theme): Contrast 0.5–1.5, Brightness 0.4–1.6, Saturation 0–2, Dim 0–0.8 (black scrim for text legibility). "Reset adjustments" restores neutral values.

## Where things live
- `lib/landingTheme.ts` – selected theme + adjustments, saved in `localStorage` (`speed-reader.landing-theme.v1`); `useLandingTheme()` keeps the menu and the landing page in sync.
- `lib/landingMedia.ts` – uploaded files, stored in IndexedDB (`speed-reader-backgrounds`).
- `components/Navigation/ThemePanel.tsx` – the menu UI. `components/Search/SearchLanding.tsx` – renders the chosen background.
- "Reset everything" in the menu also clears the saved theme and uploads.

## Notes
- Grainient needs WebGL2; without it the hero simply shows the page background.
- Defaults leave the original dot background untouched (no filter is applied at neutral values).
- The Grainient theme is dark by design; on the light site theme use Brightness/Dim to keep the headline readable.
