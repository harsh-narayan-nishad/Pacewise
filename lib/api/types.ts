// Mirrors the backend's Prisma models (speed-reader-backend/prisma/schema.prisma)
// and DTOs closely on purpose — this is the one place the frontend's view
// of "what the backend returns" is written down.

export interface ApiUser {
  id: string;
  email: string;
  username: string;
  name: string;
  interests: string[];
  avatarUrl: string | null;
}

export interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface ApiStoryMediaPage {
  src: string;
  width: number;
  height: number;
}

export interface ApiStoryMedia {
  kind: "pdf" | "image";
  pages: ApiStoryMediaPage[];
  estimatedWordCount: number;
}

export interface ApiQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ApiStory {
  id: string;
  title: string;
  description: string | null;
  authorId: string | null;
  author: { username: string; name: string; avatarUrl: string | null } | null;
  level: string;
  estimatedWPM: number;
  tags: string[];
  paragraphs: string[];
  questions: ApiQuestion[];
  media: ApiStoryMedia | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiNotification {
  id: string;
  recipientId: string;
  senderId: string;
  sender: { username: string; name: string; avatarUrl: string | null };
  type: "SHARE" | "LIKE" | "COMMENT" | "FOLLOW";
  storyId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ApiComment {
  id: string;
  storyId: string;
  userId: string;
  user: { username: string; name: string; avatarUrl: string | null };
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlaylist {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  /** Public playlists are readable by anyone; private (the default) only
   *  by their owner — see the backend's playlists.service.ts. */
  isPublic: boolean;
  items: { id: string; storyId: string; story: { id: string; title: string } }[];
}

export interface ApiReadingSession {
  id: string;
  userId: string;
  storyId: string | null;
  wpm: number;
  minutes: number;
  completed: boolean;
  breakMs: number;
  breakCount: number;
  effectiveWpm: number | null;
  reductionPercent: number | null;
  accuracy: number | null;
  totalQuestions: number | null;
  correctAnswers: number | null;
  createdAt: string;
}

export interface ApiHistoryStats {
  sessionCount: number;
  averageWpm: number;
  bestWpm: number;
  averageAccuracy: number | null;
  totalMinutes: number;
}
