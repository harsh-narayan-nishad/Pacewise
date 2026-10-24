"use client";

import React from "react";
import { UserProfile } from "@/components/Profile/UserProfile";

/** New route, additive — the app had no per-user page before this phase.
 *  Dynamic segment matches the existing App Router convention (same shape
 *  as the brief's own `/content/123` example) rather than inventing a
 *  different routing style. */
export default function ProfilePage({ params }: { params: { userId: string } }) {
  return <UserProfile userId={params.userId} />;
}
