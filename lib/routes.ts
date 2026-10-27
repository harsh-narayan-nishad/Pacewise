/** Single source of truth for every in-app URL, so links can't drift or 404. */
export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  history: "/history",
  readingHistory: "/reading-history",
  analytics: "/analytics",
  settings: "/settings",
  results: "/results",
  story: (id: string) => `/story/${encodeURIComponent(id)}`,
  profile: (userId: string) => `/profile/${userId}`,
  notes: (userId: string) => `/notes/${encodeURIComponent(userId)}`,
} as const;
