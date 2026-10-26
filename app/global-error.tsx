"use client";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself (where
 * app/error.tsx cannot). Must render its own <html>/<body> and so uses inline
 * styles only — no app CSS or providers are guaranteed to exist here.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0c0e", color: "#edeef0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", color: "#9a9ca3" }}>
            An unexpected error occurred.{error.digest ? ` (ref ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{ border: 0, borderRadius: 999, padding: "10px 22px", background: "#edeef0", color: "#0b0c0e", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
