"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/button";
import { relationsApi } from "@/lib/api/endpoints";
import { isApiEnabled } from "@/lib/api/config";
import { devDataStore } from "@/lib/devData/store";
import { useNavLoader } from "@/contexts/NavLoaderContext";
import { ROUTES } from "@/lib/routes";

interface Person { id: string; name: string; username?: string }

/**
 * Pop-up list of a person's followers or of the people they follow. Anyone can open it, and each row opens
 * that person's profile. The list comes from the database; without a backend it is built from this browser's copy.
 */
export function FollowList({ userId, kind, onClose }: { userId: string; kind: "followers" | "following"; onClose: () => void }) {
  const nav = useNavLoader();
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      if (!isApiEnabled()) throw new Error("local");
      const res = await relationsApi[kind](userId, p);
      // Make sure the avatars / names of these people are known in this browser.
      devDataStore.mergeUsers(res.items.map((i) => ({ id: i.id, username: i.username, name: i.name, interests: [], isDemoUser: false })));
      setPeople((cur) => (p === 1 ? res.items : [...cur, ...res.items]));
      setTotal(res.total);
    } catch {
      const rows = devDataStore.relationIds(userId, kind).map((id) => devDataStore.findUserById(id)).filter((u): u is NonNullable<typeof u> => Boolean(u)).map((u) => ({ id: u.id, name: u.name, username: u.username }));
      setPeople(rows);
      setTotal(rows.length);
    } finally {
      setLoading(false);
    }
  }, [kind, userId]);

  useEffect(() => { setPage(1); void load(1); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = kind === "followers" ? "Followers" : "Following";
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[80vh] w-full max-w-md flex-col rounded-[28px] border border-overlay/10 bg-canvas-raised shadow-themed">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h3 className="font-display text-2xl tracking-[-0.02em] text-ink">{title} <span className="text-base text-ink-muted">{total}</span></h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-overlay/5 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <ul className="flex-1 divide-y divide-overlay/10 overflow-y-auto px-2 pb-3">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onClose(); nav.push(ROUTES.profile(p.id)); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-overlay/5">
                <Avatar userId={p.id} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                  {p.username && <span className="block truncate text-xs text-ink-muted">@{p.username}</span>}
                </span>
              </button>
            </li>
          ))}
          {!loading && people.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-muted">{kind === "followers" ? "No followers yet." : "Not following anyone yet."}</li>}
        </ul>
        {people.length < total && (
          <div className="px-6 pb-5 pt-1 text-center">
            <Button size="sm" variant="outline" disabled={loading} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Show more</Button>
          </div>
        )}
      </div>
    </div>
  );
}
