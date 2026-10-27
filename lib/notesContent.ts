/**
 * Interview notes: how core CS subjects show up in Pacewise, and what each choice costs.
 * Plain data, so the profile tab and the public page render exactly the same content.
 */
export interface NoteItem {
  topic: string;
  /** Where it appears in this project. */
  used: string;
  /** What was given up for it. */
  tradeoff: string;
}
export interface NoteSection {
  id: string;
  title: string;
  summary: string;
  items: NoteItem[];
}

export const NOTES: NoteSection[] = [
  {
    id: "cn",
    title: "Computer Networks",
    summary: "How the browser, the Next.js app and the API talk to each other.",
    items: [
      { topic: "HTTP request / response and REST", used: "The frontend calls the Express API with JSON over HTTP; each call is stateless and carries its own token.", tradeoff: "Stateless calls scale and cache well, but every request repeats headers and auth, and the server cannot push updates by itself." },
      { topic: "TLS, CORS and cookies vs tokens", used: "The API only accepts calls from the app's own origin; login tokens are kept per user on the client.", tradeoff: "Tokens in storage are simple and work across origins, but are exposed to XSS. HttpOnly cookies are safer, but need CSRF protection and same-site setup." },
      { topic: "Caching and CDN", used: "Next.js serves hashed JS/CSS and static pages with long cache lifetimes; fonts come from a CDN.", tradeoff: "Great speed for repeat visits, but a stale file can linger until the hash changes, and personalised pages cannot be cached the same way." },
      { topic: "Polling vs WebSockets", used: "Reading presence is a 5-second heartbeat with a 60-second idle window, like an online indicator.", tradeoff: "A heartbeat is simple and survives flaky networks, but wastes requests and lags by up to a beat. WebSockets are instant but need sticky connections and reconnect logic." },
      { topic: "Payload size and latency", used: "An uploaded PDF becomes one image per page, read entirely in the browser instead of being sent to a server.", tradeoff: "No upload wait and no server cost, but big files use a lot of memory and cannot be shared across devices without an upload." },
    ],
  },
  {
    id: "os",
    title: "Operating Systems",
    summary: "Processes, threads, memory and scheduling as they affect a reading app.",
    items: [
      { topic: "Single-threaded event loop", used: "The browser UI and the Node API both run on one event loop; auto-scroll and the inertia easing run once per animation frame.", tradeoff: "No locks or data races to worry about, but one slow task (parsing a big PDF) freezes the page unless it is chunked or moved to a worker." },
      { topic: "Scheduling and timers", used: "The heartbeat only runs while the tab is visible, because browsers throttle background timers.", tradeoff: "Stops false 'reading' time and saves battery, but a tab left in the background correctly counts as idle even if the person is listening." },
      { topic: "Memory and quotas", used: "localStorage is capped at about 5 MB per origin. A large PDF can exceed it, so ownership is saved separately as a tiny record.", tradeoff: "Keeping data on the device is fast and private, but it is limited, per browser, and can be cleared. Heavy data belongs in IndexedDB or on a server." },
      { topic: "Concurrency across tabs", used: "Several tabs share one localStorage; the app listens for storage events so they do not overwrite each other blindly.", tradeoff: "Cheap sharing, but there are no transactions, so two tabs writing at once can still lose an update (last write wins)." },
      { topic: "Blocking vs non-blocking I/O", used: "The API uses async database calls so one slow query does not stop other requests.", tradeoff: "High throughput on few threads, but CPU-heavy work still blocks everything and needs a worker or queue." },
    ],
  },
  {
    id: "oops",
    title: "Object-Oriented Design",
    summary: "The class design behind per-user data, and why it is built that way.",
    items: [
      { topic: "Abstraction and inheritance", used: "UserScopedRepository is an abstract base class; ListRepository extends it; history, bookmarks and uploads extend that.", tradeoff: "Shared read/write code lives in one place, but deep hierarchies are harder to change. Composition is more flexible when behaviours differ a lot." },
      { topic: "Template method", used: "The base class fixes the algorithm (build key, read, parse safely, write) and subclasses only supply feature(), emptyValue() and deserialize().", tradeoff: "Every repository behaves consistently, at the cost of subclasses being tied to the base class's steps." },
      { topic: "Encapsulation", used: "read() and write() are protected, so callers only see intention-revealing methods like save() or toggle().", tradeoff: "Storage can change without touching callers, but there is a little more code than reading storage directly." },
      { topic: "Dependency inversion", used: "Repositories depend on a KeyValueStore interface; the app passes localStorage and tests pass an in-memory map. Story ownership is looked up through an injected resolver.", tradeoff: "Easy testing and no circular imports, but there is an extra layer to learn and wire up in one composition file." },
      { topic: "Facade and single responsibility", used: "SessionManager hands out one UserSession per person, which keeps each user's data apart.", tradeoff: "A clear single entry point, but it becomes a bottleneck class if it keeps collecting unrelated duties." },
    ],
  },
  {
    id: "dbms",
    title: "Database Systems",
    summary: "How data is modelled, partitioned and kept consistent.",
    items: [
      { topic: "Relational model and an ORM", used: "The backend stores users, stories and attempts in tables and reaches them through Prisma.", tradeoff: "Strong structure and joins, but schema changes need migrations and an ORM can hide slow queries." },
      { topic: "Key-value storage and partitioning by user", used: "On the client every key starts with the user's id, so one person's data is a separate partition.", tradeoff: "Perfect isolation and trivial lookups, but there is no cross-user query: finding a story's owner means scanning keys." },
      { topic: "Denormalised daily aggregates", used: "One DailyActivity row per day stores sums and counts that the heatmap, pace chart and efficiency view read directly.", tradeoff: "Charts are instant and cheap, but the raw per-session detail is lost and a bug in the aggregation cannot be replayed." },
      { topic: "Atomicity and rollback", used: "Saving a story writes its index and its content; if the index write fails, the content write is rolled back (covered by a test).", tradeoff: "No half-saved records, but without real transactions this is manual and easy to get wrong." },
      { topic: "Indexing, pagination and ids", used: "History and attempts are grouped by date and paged 10 groups at a time; ownership claims are a small id list kept apart from large story blobs.", tradeoff: "Fast screens and small lookups, but an extra structure must be kept in sync with the main data." },
    ],
  },
];
