"use client";

import React from "react";
import { User } from "lucide-react";
import { devDataStore } from "@/lib/devData/store";
import { useDevStoreVersion } from "@/lib/devData/useDevStore";
import { safeAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface AvatarProps {
  userId: string | null | undefined;
  /** Pixel size of the circle. */
  size?: number;
  className?: string;
}

/** A user's profile photo; falls back to their initial, then a generic icon. */
export function Avatar({ userId, size = 32, className }: AvatarProps) {
  useDevStoreVersion();
  const photo = userId ? safeAvatar(devDataStore.getAvatar(userId)) : null;
  const name = userId ? devDataStore.findUserById(userId)?.name : undefined;
  const style = { width: size, height: size };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name ? `${name}'s profile photo` : "Profile photo"} style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span style={style} className={cn("flex shrink-0 items-center justify-center rounded-full bg-ink text-canvas", className)} aria-hidden>
      {name ? <span style={{ fontSize: size * 0.42 }} className="font-medium uppercase leading-none">{name.trim()[0]}</span> : <User style={{ width: size * 0.5, height: size * 0.5 }} />}
    </span>
  );
}
