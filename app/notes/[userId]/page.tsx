"use client";

import React from "react";
import { PublicNotesPage } from "@/components/Notes/PublicNotesPage";

/** Notes page (sign-in required): the page a person's QR code opens. See lib/publicRoutes.ts. */
export default function NotesRoute({ params }: { params: { userId: string } }) {
  return <PublicNotesPage userId={params.userId} />;
}
