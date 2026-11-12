"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Reader from "@/components/FlipReader/reader/Reader";
import { hasPendingFiles } from "@/lib/flipreader/handoff";

/**
 * The flip book. It opens straight onto the book you just added (a PDF from the search bar's upload button).
 * With nothing to open it goes back to the start page instead of showing an empty reader.
 */
export default function FlipBookPage() {
  const router = useRouter();
  const [hasFiles] = useState(() => hasPendingFiles());

  useEffect(() => {
    if (!hasFiles) router.replace("/");
  }, [hasFiles, router]);

  if (!hasFiles) return null;
  return (
    <div className="fr-embed">
      <Reader />
    </div>
  );
}
