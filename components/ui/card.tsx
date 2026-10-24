import React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-overlay/10 bg-canvas-raised/60 backdrop-blur-sm p-5",
        className
      )}
      {...props}
    />
  );
}
