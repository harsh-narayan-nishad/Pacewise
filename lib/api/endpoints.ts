import { apiFetch } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/tokenStore";
import {
  GoogleResult,
  ApiComment,
  ApiHistoryStats,
  ApiNotification,
  ApiPlaylist,
  ApiReadingSession,
  ApiStory,
  ApiUser,
  ApiPerson,
  AuthResponse,
  SignupResult,
  Paginated,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
/** Create an account. Returns the user + tokens; the CALLER stores the tokens (see AuthContext), because they are saved per signed-in user. */
export function signup(input: { email: string; username: string; password: string; name: string }) {
  return apiFetch<SignupResult>("/auth/signup", { method: "POST", body: { ...input, device: "web" }, skipAuth: true });
}

/** Verify credentials (email OR username + password). Returns the user + tokens. */
export function login(input: { identifier: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/login", { method: "POST", body: { ...input, device: "web" }, skipAuth: true });
}

/** Sign in or sign up with the ID token Google gave the browser. The backend verifies it with Google. */
export function loginWithGoogle(idToken: string) {
  return apiFetch<GoogleResult>("/auth/google", { method: "POST", body: { idToken, device: "web" }, skipAuth: true });
}

/** Who the current access token belongs to (refreshes the token first if it has expired). */
export async function me(): Promise<ApiUser> {
  return (await apiFetch<{ user: ApiUser }>("/auth/me")).user;
}

/** Changes the password; every other device is signed out and this one gets fresh tokens. */
export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiFetch<AuthResponse>("/auth/change-password", { method: "POST", body: input });
}

/** E-mail flows (links arrive by e-mail; see the backend's docs/AUTH_AND_POSTMAN.md). */
export const verifyEmail = (token: string) => apiFetch<{ verified: boolean }>("/auth/verify-email", { method: "POST", body: { token }, skipAuth: true });
export const resendVerification = (email: string) => apiFetch<{ sent: boolean }>("/auth/resend-verification", { method: "POST", body: { email }, skipAuth: true });
export const forgotPassword = (email: string) => apiFetch<{ sent: boolean }>("/auth/forgot-password", { method: "POST", body: { email }, skipAuth: true });
export const resetPassword = (input: { token: string; newPassword: string }) => apiFetch<{ reset: boolean }>("/auth/reset-password", { method: "POST", body: input, skipAuth: true });

/** Same two actions with the 6-digit code from the e-mail instead of the link. */
export const verifyEmailOtp = (input: { email: string; otp: string }) => apiFetch<{ verified: boolean }>("/auth/verify-email-otp", { method: "POST", body: input, skipAuth: true });
export const resetPasswordOtp = (input: { email: string; otp: string; newPassword: string }) => apiFetch<{ reset: boolean }>("/auth/reset-password-otp", { method: "POST", body: input, skipAuth: true });

/** Everyone with an account (optionally only those changed after a date), for the follow / share lists. */
export const listPeople = (updatedSince?: string) => apiFetch<ApiPerson[]>("/users", { query: { updatedSince } });

/** Live "is this username / email free?" check for the sign-up form. */
export function availability(q: { username?: string; email?: string }) {
  return apiFetch<{ username?: boolean; email?: boolean }>("/auth/availability", { skipAuth: true, query: q });
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  tokenStore.clear();
  if (!refreshToken) return;
  try {
    await apiFetch<void>("/auth/logout", { method: "POST", body: { refreshToken } });
  } catch {
    // Already cleared locally — a failed server-side revoke (e.g. backend
    // briefly unreachable) shouldn't block the user from appearing logged
    // out in this browser.
  }
}

export async function logoutAllDevices(): Promise<void> {
  await apiFetch<void>("/auth/logout-all", { method: "POST" });
  tokenStore.clear();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const usersApi = {
  getProfile: (username: string) => apiFetch<ApiUser>(`/users/${encodeURIComponent(username)}`),
  updateMe: (patch: Partial<Pick<ApiUser, "name" | "interests" | "avatarUrl">>) =>
    apiFetch<ApiUser>("/users/me", { method: "PATCH", body: patch }),
  follow: (username: string) => apiFetch<void>(`/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),
  unfollow: (username: string) => apiFetch<void>(`/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
export interface CreateStoryInput {
  title: string;
  description?: string;
  level?: string;
  estimatedWPM?: number;
  tags?: string[];
  paragraphs?: string[];
  questions?: ApiStory["questions"];
  media?: ApiStory["media"];
}

export const storiesApi = {
  list: (query: { q?: string; tag?: string; authorUsername?: string; page?: number; pageSize?: number } = {}) =>
    apiFetch<Paginated<ApiStory>>("/stories", { query }),
  get: (id: string) => apiFetch<ApiStory>(`/stories/${id}`),
  create: (input: CreateStoryInput) => apiFetch<ApiStory>("/stories", { method: "POST", body: input }),
  update: (id: string, patch: Partial<CreateStoryInput>) =>
    apiFetch<ApiStory>(`/stories/${id}`, { method: "PATCH", body: patch }),
  remove: (id: string) => apiFetch<void>(`/stories/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Social (reactions / comments / shares / bookmarks)
// ---------------------------------------------------------------------------
export const socialApi = {
  react: (storyId: string, type: "LIKE" | "DISLIKE") =>
    apiFetch<{ type: "LIKE" | "DISLIKE" }>(`/stories/${storyId}/reaction`, { method: "PUT", body: { type } }),
  clearReaction: (storyId: string) => apiFetch<void>(`/stories/${storyId}/reaction`, { method: "DELETE" }),
  listComments: (storyId: string) => apiFetch<ApiComment[]>(`/stories/${storyId}/comments`),
  addComment: (storyId: string, text: string) =>
    apiFetch<ApiComment>(`/stories/${storyId}/comments`, { method: "POST", body: { text } }),
  deleteComment: (commentId: string) => apiFetch<void>(`/comments/${commentId}`, { method: "DELETE" }),
  share: (storyId: string, receiverUsername: string) =>
    apiFetch<{ alreadyShared: boolean }>(`/stories/${storyId}/share`, { method: "POST", body: { receiverUsername } }),
  toggleBookmark: (storyId: string) =>
    apiFetch<{ bookmarked: boolean }>(`/stories/${storyId}/bookmark`, { method: "PUT" }),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationsApi = {
  list: () => apiFetch<ApiNotification[]>("/notifications"),
  markRead: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => apiFetch<void>("/notifications/read-all", { method: "POST" }),
  /** Opens a live SSE connection — see lib/api/useNotificationStream.ts for
   *  the React hook that wraps this. Not a plain apiFetch call because
   *  EventSource doesn't send custom headers, so the access token travels
   *  as a query param instead (over HTTPS in any real deployment). */
  streamUrl: (apiBaseUrl: string, accessToken: string) =>
    `${apiBaseUrl}/notifications/stream?token=${encodeURIComponent(accessToken)}`,
};

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------
export const playlistsApi = {
  list: () => apiFetch<ApiPlaylist[]>("/playlists"),
  get: (id: string) => apiFetch<ApiPlaylist>(`/playlists/${id}`),
  /** Every public playlist belonging to the given user — readable without
   *  being its owner (e.g. from that user's profile page). */
  listPublicFor: (userId: string) => apiFetch<ApiPlaylist[]>(`/playlists/public/${encodeURIComponent(userId)}`),
  create: (name: string, isPublic?: boolean) =>
    apiFetch<ApiPlaylist>("/playlists", { method: "POST", body: { name, isPublic } }),
  rename: (id: string, name: string) => apiFetch<ApiPlaylist>(`/playlists/${id}`, { method: "PATCH", body: { name } }),
  setVisibility: (id: string, isPublic: boolean) =>
    apiFetch<ApiPlaylist>(`/playlists/${id}`, { method: "PATCH", body: { isPublic } }),
  remove: (id: string) => apiFetch<void>(`/playlists/${id}`, { method: "DELETE" }),
  addItem: (id: string, storyId: string) =>
    apiFetch<void>(`/playlists/${id}/items`, { method: "POST", body: { storyId } }),
  removeItem: (id: string, storyId: string) => apiFetch<void>(`/playlists/${id}/items/${storyId}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Reading history
// ---------------------------------------------------------------------------
export interface ApiHighlights {
  speed: { title: string; wpm: number }[];
  comprehension: { title: string; accuracy: number }[];
  consistency: { weeksAgo: number; activeDays: number }[];
}

export interface RecordSessionInput {
  storyId?: string;
  title?: string;
  wordCount?: number;
  wpm: number;
  minutes: number;
  completed: boolean;
  breakMs?: number;
  breakCount?: number;
  effectiveWpm?: number;
  reductionPercent?: number;
  accuracy?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  topics?: { topic: string; correct: number; total: number }[];
}

export const historyApi = {
  record: (input: RecordSessionInput) => apiFetch<ApiReadingSession>("/history", { method: "POST", body: input }),
  list: (page = 1, pageSize = 20) => apiFetch<Paginated<ApiReadingSession>>("/history", { query: { page, pageSize } }),
  stats: () => apiFetch<ApiHistoryStats>("/history/stats"),
  /** Best speeds, best quiz scores and active days per week, worked out by the server (landing page). */
  highlights: (today: string) => apiFetch<ApiHighlights>("/history/highlights", { query: { today } }),
  /** Edit the topic labels of one attempt (allowed for 2 days after the test; the score itself never changes). */
  updateTopics: (id: string, topics: { topic: string; correct: number; total: number }[]) =>
    apiFetch<{ id: string; topicsLocked: boolean; topicsEditableUntil: string }>(`/history/${encodeURIComponent(id)}/topics`, { method: "PATCH", body: { topics } }),
};

// ---------------------------------------------------------------------------
// Uploads (presigned S3 URLs for PDF/image stories)
// ---------------------------------------------------------------------------
export const uploadsApi = {
  presign: (filename: string, contentType: string) =>
    apiFetch<{ uploadUrl: string; key: string; expiresInSeconds: number }>("/uploads/presign", {
      method: "POST",
      body: { filename, contentType },
    }),
  getDownloadUrl: (key: string) =>
    apiFetch<{ url: string; expiresInSeconds: number }>(`/uploads/${encodeURIComponent(key)}/url`),
  /** Uploads a File/Blob directly to object storage using a presigned PUT
   *  URL — bypasses apiFetch entirely (and therefore the backend) on
   *  purpose, see the backend README's "distributed design" section. */
  async uploadFile(file: File, uploadUrl: string): Promise<void> {
    const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
  },
};

// ---------------------------------------------------------------------------
// Calendar (the Calendar tab of the profile)
// ---------------------------------------------------------------------------
export type CalendarVariant = "primary" | "secondary" | "outline";
export interface ApiCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  variant: CalendarVariant;
}
export interface CalendarEventInput {
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  variant?: CalendarVariant;
}

export const calendarApi = {
  list: () => apiFetch<ApiCalendarEvent[]>("/calendar/events"),
  create: (input: CalendarEventInput & { title: string; start: string; end: string }) => apiFetch<ApiCalendarEvent>("/calendar/events", { method: "POST", body: input }),
  update: (id: string, input: CalendarEventInput) => apiFetch<ApiCalendarEvent>(`/calendar/events/${encodeURIComponent(id)}`, { method: "PATCH", body: input }),
  remove: (id: string) => apiFetch<void>(`/calendar/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Followers / following lists (public)
// ---------------------------------------------------------------------------
export interface ApiRelationPerson { id: string; username: string; name: string; avatarUrl: string | null }
export interface ApiRelationPage { items: ApiRelationPerson[]; total: number; page: number; pageSize: number }

export const relationsApi = {
  followers: (userId: string, page = 1, pageSize = 30) => apiFetch<ApiRelationPage>(`/users/${encodeURIComponent(userId)}/followers`, { query: { page, pageSize } }),
  following: (userId: string, page = 1, pageSize = 30) => apiFetch<ApiRelationPage>(`/users/${encodeURIComponent(userId)}/following`, { query: { page, pageSize } }),
};
