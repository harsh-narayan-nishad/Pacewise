# Frontend

**Operating system · Frontend.** The browser is a small operating system for your app: it schedules work, limits memory, isolates tabs and gives you storage. This page maps those ideas to Pacewise's code.

## The tab is a process; the page is one thread of JavaScript
- Each tab runs in its own **process** (browser sandbox), so a crash or leak in one tab does not touch another.
- Your code runs on the **main thread** with an **event loop**: one task at a time. Rendering, clicks and your code share that thread, so a long loop freezes the screen (a "long task", over 50 ms). Slow PDF parsing is the standard example.
- **Web Worker**: the PDF library runs in its own thread (`/pdf.worker.min.mjs`) so parsing does not block scrolling. Workers have separate memory and talk by messages (**IPC**).

## Scheduling
| API | Used for |
|---|---|
| `setTimeout` | 400 ms debounce before sync, 3 s flush of tracking events, navigation loader delay |
| `setInterval` | 5 s reading heartbeat (`PresenceTracker`), 15 s backend poll |
| `requestAnimationFrame` | Smooth animations, synchronised with the screen's refresh |
| Page Visibility (`visibilitychange`) | Pauses reading time when the tab is hidden and flushes queued data; browsers also throttle timers in background tabs, which is why elapsed time is measured with `performance.now()` rather than by counting ticks |

## Memory
- The tab has a limited heap managed by a **garbage collector**: an object is freed when nothing references it. Forgotten timers, event listeners and big arrays are the usual leaks, which is why effects return a cleanup function (`clearInterval`, `removeEventListener`).
- Large files (PDFs) are the biggest consumer. The plan to load only the page being read plus a few neighbours is **demand paging** and **prefetching** applied in the browser.
- Images and PDF pages stored as `data:` text cost about a third more memory than the binary.

## Storage and the file system
- `localStorage` is a small key-value store (about 5 MB per site), **synchronous**: every `setItem` blocks the main thread until the data is written. Writing the whole data store after each click is the "random pauses" finding in the investigation.
- Past the quota the write throws, so every write is wrapped in `try/catch` and the app keeps working in memory.
- Keys are namespaced per user (`srt:v2:u:<userId>:<feature>`), a tiny version of **per-user directories and permissions**.
- Files come in through the file picker (the browser opens the file for the page, the page never gets a path), which is the **sandbox** idea: the app only sees what the user hands it.

## Concurrency inside one browser
- Two tabs of the same site share `localStorage`. They can overwrite each other (a **race condition**); the app avoids it by keeping data per user and re-reading when needed.
- **Single-flight refresh** (one shared promise for token renewal) is a mutex written with a promise: the first caller does the work, others wait for its result.

## Questions you can be asked
- What is a long task and how do you remove one?
- Why measure time with `performance.now()` and not by counting timer ticks?
- What is the difference between a process, a thread and a Web Worker?
- What happens when `localStorage` is full?
