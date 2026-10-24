import { KeyValueStore } from "@/lib/session/storage/KeyValueStore";
import { UserNamespace } from "@/lib/session/UserNamespace";

/** Maps an `sr-img:<id>` reference to a displayable data URL (or null). */
export type ImageSrcResolver = (src: string) => string | null;

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/;
const REF = /^sr-img:([a-z0-9]+)$/;

/**
 * Resolver used by the READER. Images are content-addressed (id = hash of
 * the bytes), so the same id always means the same bytes. Lookup order:
 *   1. the active user's own image rows;
 *   2. any other user's row with that id. This is what lets a story that
 *      was adopted from another profile (see
 *      `SessionManager.findCustomStoryAnywhere`) still show its images.
 * Whatever is found is re-validated as a base64 raster data URL, so a
 * tampered storage value can never become a `javascript:` or SVG source.
 */
export function createStoreImageResolver(kv: KeyValueStore, ns: UserNamespace): ImageSrcResolver {
  const memo = new Map<string, string | null>();
  return (src) => {
    const m = REF.exec(src);
    if (!m) return SAFE_DATA_IMAGE.test(src) || /^https?:\/\//i.test(src) ? src : null;
    const id = m[1];
    if (memo.has(id)) return memo.get(id) ?? null;
    let value = kv.getItem(ns.key(`docs:img:${id}`));
    if (value === null) {
      const suffix = `:docs:img:${id}`;
      const other = kv.keys().find((k) => k.endsWith(suffix));
      value = other ? kv.getItem(other) : null;
    }
    const ok = value !== null && SAFE_DATA_IMAGE.test(value) ? value : null;
    memo.set(id, ok);
    return ok;
  };
}
