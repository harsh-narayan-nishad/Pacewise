import { apiFetch } from "@/lib/api/client";
import { tokenStore } from "@/lib/api/tokenStore";
import {
  ApiComment,
  ApiHistoryStats,
  ApiNotification,
  ApiPlaylist,
  ApiReadingSession,
  ApiStory,
  ApiUser,
  AuthResponse,
  Paginated,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function signup(input: { email: string; username: string; password: string; name: string }) {
  const result = await apiFetch<AuthResponse>("/auth/signup", { method: "POST", body: { ...input, device: "web" }, skipAuth: true });
  tokenStore.setTokens(result.accessToken, result.refreshToken);
  return result.user;
}

export async function login(input: { identifier: string; password: string }) {
  const result = await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: { ...input, device: "web" }, skipAuth: true });
  tokenStore.setTokens(result.accessToken, result.refreshToken);
  return result.user;
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
export interface RecordSessionInput {
  storyId?: string;
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
}

export const historyApi = {
  record: (input: RecordSessionInput) => apiFetch<ApiReadingSession>("/history", { method: "POST", body: input }),
  list: (page = 1, pageSize = 20) => apiFetch<Paginated<ApiReadingSession>>("/history", { query: { page, pageSize } }),
  stats: () => apiFetch<ApiHistoryStats>("/history/stats"),
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
