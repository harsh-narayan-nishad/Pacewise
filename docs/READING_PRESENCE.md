# Reading status, total reading time, theme & uploads

## Reading status (heartbeat)
`lib/readingPresence.ts` works like WhatsApp's "online". Every 5 seconds a heartbeat checks:
1. the person is on a reading surface (story article in view, `/read`, or the playing `/reader`),
2. the tab is visible, and
3. they did something (scroll, key, pointer, touch) in the last 60 seconds.

All true → the navbar shows **● Reading** beside the clock and the beat adds its elapsed time to the user's total. Any false → status drops to idle on the next beat and nothing is added. A sleeping laptop adds at most two beats. Totals are stored per user (`speed-reader:reading-time:<userId>`) and shown next to the profile photo (hover for the full text). `components/Session/PresenceTracker.tsx` wires the browser in; tests: `npm run test:presence`.

## Theme
The default follows the system light/dark setting and updates live. Choosing a theme yourself (switch or Settings) is remembered and wins from then on.

## Uploading
- PDF/image upload now opens a modal in the same design as "Add your own story"; quiz questions can be typed one by one or pasted / loaded as JSON.
- Dragging a story `.json`, PDF or image onto the landing page behaves exactly like the upload button (it shows a "Drop to upload" overlay).

## Story page
The stats, About, reading-speed card and Start/Bookmark block below the article were removed; the navbar no longer shows WPM readouts.
