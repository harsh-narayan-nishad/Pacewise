"use client";

import { useRef, useState } from "react";
import { devDataStore } from "@/lib/devData/store";
import { fileToAvatar } from "@/lib/avatar";

/** Shared behaviour for "change profile photo" buttons (profile page + menu). */
export function useAvatarUpload(userId: string | null | undefined) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !userId) return;
    setBusy(true);
    setError(null);
    try {
      devDataStore.setAvatar(userId, await fileToAvatar(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return {
    inputRef,
    error,
    busy,
    choose: () => inputRef.current?.click(),
    remove: () => { if (userId) devDataStore.setAvatar(userId, null); },
    onFile,
  };
}
