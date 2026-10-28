/** Pages anyone can open without signing in (e.g. the notes a QR code points to). */
export function isPublicPath(pathname: string | null | undefined): boolean {
  return !!pathname && /^\/notes\/[^/]+(\/docs\/[^/]+)?\/?$/.test(pathname);
}

/** Home address of the deployed app. `NEXT_PUBLIC_SITE_URL` overrides it (e.g. once a custom domain is set). */
export const SITE_ORIGIN = "https://pacewise-delta.vercel.app";

/** Absolute link to a person's public notes page. Always the deployed address, so a QR scanned on a phone works even when the app is being run locally. */
export function notesUrl(userId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || SITE_ORIGIN).replace(/\/$/, "");
  return `${base}/notes/${encodeURIComponent(userId)}`;
}
