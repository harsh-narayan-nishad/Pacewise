import { Reaction } from "@/types";

/**
 * ============================================================================
 * TEMPORARY DEVELOPMENT DATA MODELS — NOT PRODUCTION CODE
 * ============================================================================
 * Every type in this file describes a record that, in production, would be
 * owned by a real backend (a database + API, auth provider, notification
 * service, etc.). For this development phase there is no backend: all of
 * it lives in the in-memory module `lib/devData/store.ts` instead, so the
 * frontend has something real to read/write against while that backend
 * doesn't exist yet.
 *
 * None of these types or the store that uses them touch localStorage,
 * sessionStorage, IndexedDB, or cookies — see store.ts's header for why,
 * and for exactly what that means for data surviving a page refresh.
 *
 * Every record below is keyed by a stable, explicit `id` string (never an
 * array index or object position), so relationships between records
 * (DevShare.contentId, DevComment.userId, etc.) stay valid no matter how
 * the underlying arrays are filtered, sorted, or re-rendered.
 * ============================================================================
 */

/** A development/demo login account. Real auth (hashed credentials, a
 *  session/JWT, a users table) must replace this entirely in production —
 *  see `isDemoUser` and `DEMO_CREDENTIALS_NOTICE` in seedUsers.ts. */
export interface DevUser {
  id: string; // "user-001".."user-020" — stable, never re-ordered or reused
  name: string;
  username: string;
  password: string; // plaintext, development-only — see seedUsers.ts
  interests: string[];
  isDemoUser: true;
}

export interface DevShare {
  id: string;
  senderId: string;
  receiverId: string;
  contentId: string;
  createdAt: string; // ISO timestamp
}

/** Every social event that generates a notification — mirrors a real
 *  social app's activity feed (like / comment / follow / share), not just
 *  the original "share" case. `contentId` is omitted for "follow" (there's
 *  no content involved — it points at a profile instead, via `senderId`). */
export type DevNotificationType = "share" | "like" | "comment" | "follow";

export interface DevNotification {
  id: string;
  recipientId: string;
  senderId: string;
  type: DevNotificationType;
  /** The content this notification is about. Absent for "follow"
   *  notifications, which link to the sender's profile instead. */
  contentId?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface DevComment {
  id: string;
  contentId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  /** Absent for a top-level comment. Present for a reply, pointing at the
   *  comment it replies to — same shape as a YouTube reply thread: one
   *  level of nesting (a reply to a reply still points at the original
   *  top-level comment, not its immediate parent), which keeps the thread
   *  a flat list-of-replies-per-comment rather than arbitrarily deep. */
  parentId?: string;
}

/** Reuses the app's existing `Reaction` union ("like" | "dislike" — see
 *  types/index.ts) instead of redefining it, per "adapt types to the
 *  existing architecture rather than creating duplicate models." */
export interface DevReaction {
  id: string;
  contentId: string;
  userId: string;
  type: Reaction;
  createdAt: string;
}

/** Like/dislike on a *comment* rather than a piece of content — kept as
 *  its own record (not reusing DevReaction) since it's keyed by commentId,
 *  not contentId, and a comment and its content can otherwise share an id
 *  namespace collision-free. One row per (commentId, userId), same
 *  exclusive like-replaces-dislike rule as DevReaction. */
export interface DevCommentReaction {
  id: string;
  commentId: string;
  userId: string;
  type: Reaction;
  createdAt: string;
}

export interface DevSave {
  id: string;
  contentId: string;
  userId: string;
  createdAt: string;
}

export interface DevPlaylistRelationship {
  id: string;
  contentId: string;
  userId: string;
  playlistId: string;
  createdAt: string;
}

/** Not in the original brief's type list, but required by its "follow
 *  unfollow options too" / profile-page requirement — added as its own
 *  record for the same reason DevSave/DevReaction are their own records
 *  rather than fields bolted onto DevUser: it's a relationship between two
 *  stable IDs, not an attribute of one user. */
export interface DevFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export type DevRecord =
  | DevUser
  | DevShare
  | DevNotification
  | DevComment
  | DevReaction
  | DevCommentReaction
  | DevSave
  | DevPlaylistRelationship
  | DevFollow;
