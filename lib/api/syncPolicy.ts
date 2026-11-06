/**
 * Client-side mirror of the backend's sync rules (speed-reader-backend/src/modules/sync/policy.ts):
 * which records THIS user is allowed to push. The server re-checks everything; this only avoids
 * sending operations that would be rejected.
 */
export const SYNC_COLLECTIONS = [
  "reactions",
  "comments",
  "commentReactions",
  "shares",
  "notifications",
  "saves",
  "playlists",
  "playlistRelationships",
  "follows",
  "avatars",
] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export type SyncRecordData = Record<string, unknown>;
export interface SyncPutOp { op: "put"; collection: SyncCollection; id: string; data: SyncRecordData }
export interface SyncDeleteOp { op: "delete"; collection: SyncCollection; id: string }
export type SyncOp = SyncPutOp | SyncDeleteOp;

const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function ownerOf(collection: SyncCollection, id: string, data: SyncRecordData): string | null {
  switch (collection) {
    case "shares": return s(data.senderId);
    case "follows": return s(data.followerId);
    case "notifications": return s(data.senderId);
    case "avatars": return id;
    default: return s(data.userId);
  }
}

/** May `userId` push this record (own records; a notification's recipient may update it, e.g. mark read). */
export function mayPush(userId: string, collection: SyncCollection, id: string, data: SyncRecordData): boolean {
  if (ownerOf(collection, id, data) === userId) return true;
  return collection === "notifications" && s(data.recipientId) === userId;
}
