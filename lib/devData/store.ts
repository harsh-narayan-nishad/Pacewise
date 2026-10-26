import { Reaction } from "@/types";
import { SEED_USERS } from "@/lib/devData/seedUsers";
import { getContentAuthorId } from "@/lib/devData/contentMeta";
import {
  DevComment,
  DevCommentReaction,
  DevFollow,
  DevNotification,
  DevNotificationType,
  DevPlaylistRelationship,
  DevReaction,
  DevSave,
  DevShare,
  DevUser,
} from "@/lib/devData/types";

/**
 * ============================================================================
 * TEMPORARY DEVELOPMENT DATA STORE — lib/devData/store.ts
 * ============================================================================
 * This module is the single, centralized, typed source of truth for every
 * piece of social/relationship data this development build needs: users,
 * shares, notifications, comments, reactions (like/dislike), saves,
 * playlists + their content relationships, and follows.
 *
 * WHY THIS EXISTS: the brief for this phase is explicit that there is no
 * database or backend yet, but the UI still needs real, working,
 * cross-component state for all of the above — not component-local React
 * state, which would reset/disagree the moment two components needed the
 * same data. So this module holds it all in plain JavaScript (module-level
 * variables) in one class, shared by every component that imports it,
 * exactly the way a real API client singleton would be shared — just
 * without a network call behind it yet. It is now additionally mirrored
 * into this browser's localStorage purely for durability across reloads
 * (see "PERSISTENCE" below) — every component still only ever reads and
 * writes through this one module's methods, never localStorage directly.
 *
 * THIS IS TEMPORARY. In production, every method below is replaced by a
 * real API call (REST/GraphQL/server actions) against a real database.
 * The method names and shapes are deliberately written the way a thin API
 * client would be — `listX`, `createX`, `updateX`, `deleteX`, each
 * returning plain data or a `{ ok, error }` result — specifically so
 * swapping the body of each method for a `fetch(...)` call is the entire
 * migration. No UI component should ever need to change when that
 * happens, only this file.
 *
 * PERSISTENCE: every mutation is also mirrored into this browser's
 * `localStorage` (see `persist()`/`hydrate()` below), so shares,
 * notifications, comments, reactions, saves, playlists, and follows now
 * survive a real page reload or closing/reopening the tab on this same
 * machine — "saved for real on this laptop," not just for one in-memory
 * session. This is still not a database or a backend: nothing leaves this
 * browser, there's no server, no sync between devices/browsers, and the
 * seeded user *accounts* themselves are not persisted (they always come
 * fresh from `seedUsers.ts` on load — only the relationships between them
 * are). Hydration happens once, explicitly, via `hydrate()`, called from a
 * small client-only effect (see `DevLoginGate.tsx`) rather than inside
 * this module's constructor, so the very first render (including Next.js's
 * server-rendered HTML) always starts from the same empty state on both
 * server and client and only loads the saved data right after mount —
 * avoiding a hydration mismatch between what the server rendered and what
 * the browser's saved data would otherwise render immediately.
 *
 * SUBSCRIPTION MODEL: components read this store via the hooks in
 * `useDevStore.ts`, which use React's `useSyncExternalStore` against the
 * `subscribe`/`getVersion` pair below — the store increments an internal
 * version counter on every mutation and notifies listeners, so a
 * notification bell, a comment list, and a like count across different
 * components all re-render immediately when any of them changes the
 * underlying data, without prop-drilling or a second copy of the state.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Extra type, adapted from the brief's model list rather than duplicating
// it: the brief specifies `DevPlaylistRelationship` (which content is in
// which playlist) but not the playlist entity itself. The app already has
// a `Playlist` concept (name + stored story ids) in the old localStorage
// layer (lib/storage.ts) — this is that same concept, owned by a stable
// userId instead of being anonymous/browser-wide, and split into its own
// record (DevPlaylist) plus relationship rows (DevPlaylistRelationship),
// matching how DevSave/DevReaction are their own join-style records rather
// than arrays bolted onto DevUser.
// ---------------------------------------------------------------------------
export interface DevPlaylist {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  /** Public playlists are visible to anyone (e.g. from a profile page);
   *  private ones (the default — matches the old, implicitly-private
   *  behavior before this field existed) are visible only to the owner.
   *  Enforced in `getPlaylist`/`listPublicPlaylists` below, not just in
   *  the UI, so a non-owner can't read a private playlist by id either. */
  isPublic: boolean;
}

type Listener = () => void;

type LoginResult = { ok: true; user: DevUser } | { ok: false; error: string };
type ShareResult = { ok: true; share: DevShare } | { ok: false; error: string };
type CommentResult = { ok: true; comment: DevComment } | { ok: false; error: string };

class DevDataStore {
  private users: DevUser[] = SEED_USERS.map((u) => ({ ...u }));
  private shares: DevShare[] = [];
  private notifications: DevNotification[] = [];
  private comments: DevComment[] = [];
  private reactions: DevReaction[] = [];
  private commentReactions: DevCommentReaction[] = [];
  private saves: DevSave[] = [];
  private playlists: DevPlaylist[] = [];
  private playlistRelationships: DevPlaylistRelationship[] = [];
  private follows: DevFollow[] = [];
  /** userId -> profile photo (small JPEG data URL, see lib/avatar.ts). */
  private avatars: Record<string, string> = {};

  private currentUserId: string | null = null;

  private version = 0;
  private listeners = new Set<Listener>();
  private counters: Record<string, number> = {};
  private hydrated = false;

  // --- subscription plumbing (for useSyncExternalStore) -------------------
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private touch() {
    this.version += 1;
    this.persist();
    this.listeners.forEach((l) => l());
  }

  private nextId(prefix: string): string {
    this.counters[prefix] = (this.counters[prefix] ?? 0) + 1;
    return `${prefix}-${this.counters[prefix]}`;
  }

  // =========================================================================
  // Persistence — localStorage-backed, so this "temporary" store survives a
  // real reload on this machine. See the file header for why hydrate() is
  // called explicitly (from a client-only effect) rather than eagerly in
  // the constructor, and why only relationships (not the user accounts
  // themselves) are saved.
  // =========================================================================
  private static readonly STORAGE_KEY = "speed-reader:dev-store:v1";

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      const snapshot = {
        shares: this.shares,
        notifications: this.notifications,
        comments: this.comments,
        reactions: this.reactions,
        commentReactions: this.commentReactions,
        saves: this.saves,
        playlists: this.playlists,
        playlistRelationships: this.playlistRelationships,
        follows: this.follows,
        avatars: this.avatars,
        currentUserId: this.currentUserId,
        counters: this.counters,
      };
      window.localStorage.setItem(DevDataStore.STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage can fail (private browsing, quota, disabled) — the store
      // keeps working in-memory for the rest of this session either way.
    }
  }

  /** Loads any previously-saved relationships from this browser's
   *  localStorage and notifies subscribers once. Safe to call more than
   *  once (a second call is a no-op) and safe to call where `window`
   *  doesn't exist (SSR) — it simply does nothing there. Called once, on
   *  mount, by a client-only effect (see DevLoginGate.tsx) rather than
   *  from this class's constructor, so the first paint on both server and
   *  client always matches (no hydration-mismatch risk) and only updates
   *  to the real, saved data a moment after mount. */
  hydrate(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(DevDataStore.STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        shares: DevShare[];
        notifications: DevNotification[];
        comments: DevComment[];
        reactions: DevReaction[];
        commentReactions: DevCommentReaction[];
        saves: DevSave[];
        playlists: DevPlaylist[];
        playlistRelationships: DevPlaylistRelationship[];
        follows: DevFollow[];
        avatars: Record<string, string>;
        currentUserId: string | null;
        counters: Record<string, number>;
      }>;
      this.shares = saved.shares ?? this.shares;
      this.notifications = saved.notifications ?? this.notifications;
      this.comments = saved.comments ?? this.comments;
      this.reactions = saved.reactions ?? this.reactions;
      this.commentReactions = saved.commentReactions ?? this.commentReactions;
      this.saves = saved.saves ?? this.saves;
      // Playlists created before `isPublic` existed come back from
      // localStorage without the field — default them to private (the
      // field's own semantics) rather than leaving it `undefined`, which
      // would make every `playlist.isPublic` check downstream need its
      // own `?? false`.
      if (saved.playlists) {
        saved.playlists = saved.playlists.map((p) => ({ ...p, isPublic: p.isPublic ?? false }));
      }
      this.playlists = saved.playlists ?? this.playlists;
      this.playlistRelationships = saved.playlistRelationships ?? this.playlistRelationships;
      this.follows = saved.follows ?? this.follows;
      this.avatars = saved.avatars ?? this.avatars;
      this.counters = saved.counters ?? this.counters;
      // Only restore "logged in" state if that user id still exists (the
      // seeded user list is fixed, so this only ever fails if someone
      // hand-edits localStorage).
      if (saved.currentUserId && this.findUserById(saved.currentUserId)) {
        this.currentUserId = saved.currentUserId;
      }
      this.version += 1;
      this.listeners.forEach((l) => l());
    } catch {
      // Corrupt/old-shape JSON — fall back to the fresh in-memory state
      // rather than throwing during app startup.
    }
  }

  // --- Notifications helper (used by share/like/comment/follow) ----------
  /** Centralizes "create a notification for one social event," so every
   *  action that should notify someone (share, like, comment, follow) goes
   *  through one place instead of five copies of the same push+touch
   *  logic. Never notifies someone about their own action. */
  private notify(input: {
    recipientId: string;
    senderId: string;
    type: DevNotificationType;
    contentId?: string;
    message: string;
  }): void {
    if (input.recipientId === input.senderId) return;
    const notification: DevNotification = {
      id: this.nextId("notif"),
      recipientId: input.recipientId,
      senderId: input.senderId,
      type: input.type,
      contentId: input.contentId,
      message: input.message,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.push(notification);
  }

  // =========================================================================
  // Users / auth (development-only — see seedUsers.ts's header)
  // =========================================================================
  listUsers(): DevUser[] {
    return this.users;
  }

  findUserById(id: string): DevUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getCurrentUser(): DevUser | null {
    return this.currentUserId ? this.findUserById(this.currentUserId) ?? null : null;
  }

  /** Development-only credential check — plaintext comparison against the
   *  seeded demo accounts. There is no hashing, no session token, and no
   *  server round-trip, because there is no backend yet; this exists only
   *  so the UI has *some* concept of "who is logged in" to attribute
   *  shares/comments/reactions to. Must be replaced by real
   *  authentication before production. */
  login(userId: string, password: string): LoginResult {
    const user = this.findUserById(userId);
    if (!user) return { ok: false, error: "Unknown development user." };
    if (user.password !== password) return { ok: false, error: "Incorrect development password." };
    this.currentUserId = user.id;
    this.touch();
    return { ok: true, user };
  }

  /** The user's profile photo, if they uploaded one. */
  getAvatar(userId: string): string | null {
    return this.avatars[userId] ?? null;
  }

  /** Sets (or, with null, removes) a user's profile photo. A user can only change their own. */
  setAvatar(userId: string, dataUrl: string | null): boolean {
    if (userId !== this.currentUserId || !this.findUserById(userId)) return false;
    if (dataUrl) this.avatars = { ...this.avatars, [userId]: dataUrl };
    else {
      const { [userId]: _removed, ...rest } = this.avatars;
      this.avatars = rest;
    }
    this.touch();
    return true;
  }

  logout(): void {
    this.currentUserId = null;
    this.touch();
  }

  // =========================================================================
  // Shares
  // =========================================================================
  listShares(filter: { senderId?: string; receiverId?: string; contentId?: string } = {}): DevShare[] {
    return this.shares.filter(
      (s) =>
        (filter.senderId === undefined || s.senderId === filter.senderId) &&
        (filter.receiverId === undefined || s.receiverId === filter.receiverId) &&
        (filter.contentId === undefined || s.contentId === filter.contentId)
    );
  }

  findShareById(id: string): DevShare | undefined {
    return this.shares.find((s) => s.id === id);
  }

  /** Creates the share AND its notification together — the brief treats
   *  "share" and "notify the recipient" as one atomic user action, and a
   *  share that somehow exists without a notification (or vice versa)
   *  would be an inconsistent state no real API would produce either. */
  createShare(input: { senderId: string; receiverId: string; contentId: string }): ShareResult {
    if (input.senderId === input.receiverId) {
      return { ok: false, error: "You can't share content with yourself." };
    }
    if (!this.findUserById(input.senderId) || !this.findUserById(input.receiverId)) {
      return { ok: false, error: "Unknown sender or recipient." };
    }
    const duplicate = this.shares.find(
      (s) =>
        s.senderId === input.senderId && s.receiverId === input.receiverId && s.contentId === input.contentId
    );
    if (duplicate) {
      return { ok: false, error: "You've already shared this with that person." };
    }

    const share: DevShare = {
      id: this.nextId("share"),
      senderId: input.senderId,
      receiverId: input.receiverId,
      contentId: input.contentId,
      createdAt: new Date().toISOString(),
    };
    this.shares.push(share);

    const sender = this.findUserById(input.senderId);
    this.notify({
      recipientId: input.receiverId,
      senderId: input.senderId,
      type: "share",
      contentId: input.contentId,
      message: `${sender?.name ?? "Someone"} shared a story with you.`,
    });

    this.touch();
    return { ok: true, share };
  }

  /** Deletes the share record only. The notification it created is its own
   *  independent record (see DevNotification's header comment on
   *  TopNav/NotificationBell) and is deleted separately — matching the
   *  brief's "preserve the notification's stable content reference until
   *  deletion" instruction for the notification side specifically. */
  deleteShare(id: string): boolean {
    const before = this.shares.length;
    this.shares = this.shares.filter((s) => s.id !== id);
    const removed = this.shares.length !== before;
    if (removed) this.touch();
    return removed;
  }

  // =========================================================================
  // Notifications
  // =========================================================================
  listNotifications(recipientId: string): DevNotification[] {
    return this.notifications
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  unreadCount(recipientId: string): number {
    return this.notifications.filter((n) => n.recipientId === recipientId && !n.read).length;
  }

  markNotificationRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (!notif || notif.read) return;
    notif.read = true;
    this.touch();
  }

  markAllNotificationsRead(recipientId: string): void {
    let changed = false;
    this.notifications.forEach((n) => {
      if (n.recipientId === recipientId && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) this.touch();
  }

  deleteNotification(id: string): boolean {
    const before = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    const removed = this.notifications.length !== before;
    if (removed) this.touch();
    return removed;
  }

  // =========================================================================
  // Comments
  // =========================================================================
  listComments(contentId: string): DevComment[] {
    return this.comments
      .filter((c) => c.contentId === contentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Just this comment's direct replies, oldest first — same "flat list
   *  under the parent" shape as YouTube's reply thread, not an arbitrarily
   *  deep tree (see DevComment.parentId's comment). */
  listReplies(parentId: string): DevComment[] {
    return this.comments
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  commentCount(contentId: string): number {
    return this.comments.filter((c) => c.contentId === contentId).length;
  }

  /** `parentId` makes this a reply instead of a top-level comment — a
   *  reply to a reply is normalized onto the original top-level comment's
   *  id (see DevComment.parentId), so the thread never grows past one
   *  level of nesting no matter how deep the user clicks "Reply". The
   *  replied-to commenter is notified in addition to the content's author
   *  (unless they're the same person, or replying to themselves). */
  createComment(input: { contentId: string; userId: string; text: string; parentId?: string }): CommentResult {
    const text = input.text.trim();
    if (!text) return { ok: false, error: "Comment can't be empty." };
    if (!this.findUserById(input.userId)) return { ok: false, error: "Unknown user." };

    let parentId = input.parentId;
    if (parentId) {
      const parent = this.comments.find((c) => c.id === parentId);
      if (!parent) return { ok: false, error: "The comment you're replying to no longer exists." };
      // Normalize onto the top-level comment, same as YouTube does when
      // you reply to a reply — keeps the thread one level deep.
      parentId = parent.parentId ?? parent.id;
    }

    const comment: DevComment = {
      id: this.nextId("comment"),
      contentId: input.contentId,
      userId: input.userId,
      text,
      createdAt: new Date().toISOString(),
      parentId,
    };
    this.comments.push(comment);

    const commenter = this.findUserById(input.userId);

    if (parentId) {
      const parent = this.comments.find((c) => c.id === parentId);
      if (parent) {
        this.notify({
          recipientId: parent.userId,
          senderId: input.userId,
          type: "comment",
          contentId: input.contentId,
          message: `${commenter?.name ?? "Someone"} replied to your comment.`,
        });
      }
    } else {
      this.notify({
        recipientId: getContentAuthorId(input.contentId),
        senderId: input.userId,
        type: "comment",
        contentId: input.contentId,
        message: `${commenter?.name ?? "Someone"} commented on your story.`,
      });
    }

    this.touch();
    return { ok: true, comment };
  }

  /** Ownership-checked: only the commenter can delete their own comment,
   *  consistent with "allow deletion ... where appropriate" rather than
   *  letting anyone delete anyone's comment. Deleting a top-level comment
   *  cascades to its replies (and their reactions) rather than leaving
   *  orphaned replies pointing at a parent that no longer exists. */
  deleteComment(id: string, requesterId: string): boolean {
    const comment = this.comments.find((c) => c.id === id);
    if (!comment || comment.userId !== requesterId) return false;
    const idsToRemove = new Set([id, ...this.comments.filter((c) => c.parentId === id).map((c) => c.id)]);
    this.comments = this.comments.filter((c) => !idsToRemove.has(c.id));
    this.commentReactions = this.commentReactions.filter((r) => !idsToRemove.has(r.commentId));
    this.touch();
    return true;
  }

  // =========================================================================
  // Comment reactions (like / dislike on a comment, not on the content
  // itself) — same exclusive-per-user shape as content reactions below,
  // just keyed by commentId.
  // =========================================================================
  getCommentReaction(commentId: string, userId: string): Reaction | null {
    return this.commentReactions.find((r) => r.commentId === commentId && r.userId === userId)?.type ?? null;
  }

  /** Counts for one comment's like/dislike buttons. */
  commentReactionCounts(commentId: string): { like: number; dislike: number } {
    let like = 0;
    let dislike = 0;
    for (const r of this.commentReactions) {
      if (r.commentId !== commentId) continue;
      if (r.type === "like") like += 1;
      else dislike += 1;
    }
    return { like, dislike };
  }

  /** Setting the same reaction again clears it (toggle), exactly like the
   *  content-level reaction buttons already behave. */
  setCommentReaction(commentId: string, userId: string, type: Reaction): void {
    const existing = this.commentReactions.find((r) => r.commentId === commentId && r.userId === userId);
    if (existing?.type === type) {
      this.commentReactions = this.commentReactions.filter((r) => r !== existing);
      this.touch();
      return;
    }
    if (existing) {
      existing.type = type;
    } else {
      this.commentReactions.push({ id: this.nextId("commentReaction"), commentId, userId, type, createdAt: new Date().toISOString() });
    }

    const comment = this.comments.find((c) => c.id === commentId);
    if (type === "like" && comment && comment.userId !== userId) {
      const liker = this.findUserById(userId);
      this.notify({
        recipientId: comment.userId,
        senderId: userId,
        type: "like",
        contentId: comment.contentId,
        message: `${liker?.name ?? "Someone"} liked your comment.`,
      });
    }

    this.touch();
  }

  clearCommentReaction(commentId: string, userId: string): void {
    const before = this.commentReactions.length;
    this.commentReactions = this.commentReactions.filter((r) => !(r.commentId === commentId && r.userId === userId));
    if (this.commentReactions.length !== before) this.touch();
  }

  // =========================================================================
  // Reactions (like / dislike) — exclusive per (contentId, userId), mirrors
  // how the previous localStorage-based reactions worked but now scoped per
  // user instead of per browser, and centrally stored instead of persisted
  // client-side.
  // =========================================================================
  getReaction(contentId: string, userId: string): Reaction | null {
    return this.reactions.find((r) => r.contentId === contentId && r.userId === userId)?.type ?? null;
  }

  reactionCounts(contentId: string): { like: number; dislike: number } {
    const rows = this.reactions.filter((r) => r.contentId === contentId);
    return {
      like: rows.filter((r) => r.type === "like").length,
      dislike: rows.filter((r) => r.type === "dislike").length,
    };
  }

  /** Passing `null` clears the reaction (clicking the same button again).
   *  Upserts rather than appending, so there is never more than one
   *  reaction row per (contentId, userId) pair — the dedup the brief asks
   *  for. Notifies the content's author only on a genuine *new* "like"
   *  (not on dislike, and not when a like is merely cleared or re-applied
   *  after already being set) — matching how real social apps only ever
   *  notify on the positive reaction, once. */
  setReaction(contentId: string, userId: string, type: Reaction | null): void {
    const existingIndex = this.reactions.findIndex((r) => r.contentId === contentId && r.userId === userId);
    const wasLiked = existingIndex !== -1 && this.reactions[existingIndex].type === "like";

    if (type === null) {
      if (existingIndex !== -1) {
        this.reactions.splice(existingIndex, 1);
        this.touch();
      }
      return;
    }
    if (existingIndex !== -1) {
      this.reactions[existingIndex] = { ...this.reactions[existingIndex], type };
    } else {
      this.reactions.push({
        id: this.nextId("reaction"),
        contentId,
        userId,
        type,
        createdAt: new Date().toISOString(),
      });
    }

    if (type === "like" && !wasLiked) {
      const liker = this.findUserById(userId);
      this.notify({
        recipientId: getContentAuthorId(contentId),
        senderId: userId,
        type: "like",
        contentId,
        message: `${liker?.name ?? "Someone"} liked your story.`,
      });
    }

    this.touch();
  }

  // =========================================================================
  // Saves (a plain bookmark-style action — distinct from "add to a named
  // playlist" below, matching the brief listing Save and Playlist as two
  // separate content actions)
  // =========================================================================
  isSaved(contentId: string, userId: string): boolean {
    return this.saves.some((s) => s.contentId === contentId && s.userId === userId);
  }

  listSavedContentIds(userId: string): string[] {
    return this.saves.filter((s) => s.userId === userId).map((s) => s.contentId);
  }

  /** Dedup-safe toggle: saving already-saved content un-saves it instead of
   *  creating a second row. Returns the new saved state. */
  toggleSave(contentId: string, userId: string): boolean {
    const existing = this.saves.find((s) => s.contentId === contentId && s.userId === userId);
    if (existing) {
      this.saves = this.saves.filter((s) => s.id !== existing.id);
      this.touch();
      return false;
    }
    this.saves.push({ id: this.nextId("save"), contentId, userId, createdAt: new Date().toISOString() });
    this.touch();
    return true;
  }

  // =========================================================================
  // Playlists + playlist-content relationships
  // =========================================================================
  listPlaylists(userId: string): DevPlaylist[] {
    return this.playlists.filter((p) => p.userId === userId);
  }

  findPlaylistById(id: string): DevPlaylist | undefined {
    return this.playlists.find((p) => p.id === id);
  }

  /** Visibility-aware lookup: the owner can always see their own playlist,
   *  anyone else only if it's public. Returns undefined (not a thrown
   *  error) for "doesn't exist" and "exists but is private to someone
   *  else" alike, so a caller can't distinguish the two and probe for
   *  private playlist ids. */
  getPlaylist(id: string, viewerId: string | null): DevPlaylist | undefined {
    const playlist = this.findPlaylistById(id);
    if (!playlist) return undefined;
    if (playlist.isPublic || playlist.userId === viewerId) return playlist;
    return undefined;
  }

  /** Every public playlist belonging to one user — e.g. for a "Playlists"
   *  section on their profile page, visible to any visitor. */
  listPublicPlaylists(userId: string): DevPlaylist[] {
    return this.playlists.filter((p) => p.userId === userId && p.isPublic);
  }

  createPlaylist(userId: string, name: string, isPublic = false): DevPlaylist | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const playlist: DevPlaylist = {
      id: this.nextId("playlist"),
      userId,
      name: trimmed,
      createdAt: new Date().toISOString(),
      isPublic,
    };
    this.playlists.push(playlist);
    this.touch();
    return playlist;
  }

  /** Owner-only, same ownership-checked shape as renamePlaylist would be —
   *  public visible to anyone, private visible only to the owner. */
  setPlaylistVisibility(id: string, requesterId: string, isPublic: boolean): boolean {
    const playlist = this.playlists.find((p) => p.id === id);
    if (!playlist || playlist.userId !== requesterId) return false;
    playlist.isPublic = isPublic;
    this.touch();
    return true;
  }

  deletePlaylist(id: string, requesterId: string): boolean {
    const playlist = this.playlists.find((p) => p.id === id);
    if (!playlist || playlist.userId !== requesterId) return false;
    this.playlists = this.playlists.filter((p) => p.id !== id);
    this.playlistRelationships = this.playlistRelationships.filter((r) => r.playlistId !== id);
    this.touch();
    return true;
  }

  listPlaylistContentIds(playlistId: string): string[] {
    return this.playlistRelationships.filter((r) => r.playlistId === playlistId).map((r) => r.contentId);
  }

  /** Which of this user's playlists already contain this content — drives
   *  the save-to-playlist popover's checkmarks. */
  playlistsContaining(userId: string, contentId: string): Set<string> {
    const ids = this.playlistRelationships
      .filter((r) => r.userId === userId && r.contentId === contentId)
      .map((r) => r.playlistId);
    return new Set(ids);
  }

  /** Dedup-safe: adding content already in the playlist is a no-op. */
  addToPlaylist(playlistId: string, contentId: string, userId: string): void {
    const exists = this.playlistRelationships.some(
      (r) => r.playlistId === playlistId && r.contentId === contentId
    );
    if (exists) return;
    this.playlistRelationships.push({
      id: this.nextId("plrel"),
      playlistId,
      contentId,
      userId,
      createdAt: new Date().toISOString(),
    });
    this.touch();
  }

  removeFromPlaylist(playlistId: string, contentId: string): void {
    const before = this.playlistRelationships.length;
    this.playlistRelationships = this.playlistRelationships.filter(
      (r) => !(r.playlistId === playlistId && r.contentId === contentId)
    );
    if (this.playlistRelationships.length !== before) this.touch();
  }

  // =========================================================================
  // Follows
  // =========================================================================
  isFollowing(followerId: string, followingId: string): boolean {
    return this.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
  }

  followerCount(userId: string): number {
    return this.follows.filter((f) => f.followingId === userId).length;
  }

  followingCount(userId: string): number {
    return this.follows.filter((f) => f.followerId === userId).length;
  }

  /** Dedup-safe toggle, same pattern as toggleSave. Returns the new
   *  following state. No-op (returns current state) if followerId ===
   *  followingId — can't follow yourself. Notifies on a new follow only,
   *  never on unfollow — matching every mainstream social app. */
  toggleFollow(followerId: string, followingId: string): boolean {
    if (followerId === followingId) return false;
    const existing = this.follows.find((f) => f.followerId === followerId && f.followingId === followingId);
    if (existing) {
      this.follows = this.follows.filter((f) => f.id !== existing.id);
      this.touch();
      return false;
    }
    this.follows.push({
      id: this.nextId("follow"),
      followerId,
      followingId,
      createdAt: new Date().toISOString(),
    });

    const follower = this.findUserById(followerId);
    this.notify({
      recipientId: followingId,
      senderId: followerId,
      type: "follow",
      message: `${follower?.name ?? "Someone"} started following you.`,
    });

    this.touch();
    return true;
  }
}

/** One shared instance, imported by every component that needs it — the
 *  "centralized ... module that acts as the temporary source of truth"
 *  the brief asks for. */
export const devDataStore = new DevDataStore();
