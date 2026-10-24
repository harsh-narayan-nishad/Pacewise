LANDING-PAGE VIDEO
==================
Replace  landing-hero.mp4  in this folder with your own video (keep the same file name).
Optional: also add landing-hero.webm (same video) for browsers without H.264; if you only have an MP4, delete the old landing-hero.webm so it does not play instead.
Optional: replace  landing-hero-poster.jpg  (shown while the video loads / if it cannot play).

Tips
- Format: MP4 (H.264). Landscape 16:9 (e.g. 1280x720 or 1920x1080) looks best.
- Keep it short (6-20 s, it loops) and under ~8 MB so the page stays fast.
- It plays automatically, muted, on a loop (browsers only allow autoplay when muted).
- If you want another file name, change VIDEO_SRC / POSTER_SRC at the top of
  components/Landing/VideoShowcase.tsx.
After replacing, hard-refresh the browser (Ctrl/Cmd+Shift+R).
