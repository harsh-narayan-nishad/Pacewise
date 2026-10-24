import type { Metadata } from "next";
import "./globals.css";
// Component stylesheets are plain global CSS. Next.js only allows plain (non-module)
// CSS to be imported from the root layout, so every one is imported here, in this
// order (after globals.css so they keep winning ties, as before). Components never
// import .css files themselves; if you add a stylesheet, add its import here, or
// name it `*.module.css` and import it from the component.
import "@/components/Reader/richContent.css";
import "@/components/ReadingMode/readingMode.css";
import "@/components/Editor/editor.css";
import { ReadingProvider } from "@/contexts/ReadingContext";
import { ThemeSync } from "@/components/ThemeSync";
import { TopNav } from "@/components/Navigation/TopNav";
import { Footer } from "@/components/Footer/Footer";
import { DevLoginGate } from "@/components/Auth/DevLoginGate";
import { ToastHost } from "@/components/ui/ToastHost";
import { AuthProvider } from "@/lib/api/AuthContext";
import { SessionBoundary } from "@/components/Session/SessionBoundary";

export const metadata: Metadata = {
  title: "Speed Reading Trainer",
  description: "Improve your English reading speed, comprehension, and focus.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        {/* Inter + JetBrains Mono: the free fallbacks of Render's PP Neue Montreal / Roobert stack. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;900&family=Roboto+Slab:wght@600;700&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap"
        />
      </head>
      <body className="bg-canvas font-sans text-ink antialiased transition-colors duration-200">
        {/* Remounts everything below when the signed-in user changes, so
            no screen/state leaks between users — see SessionBoundary.
            AuthProvider sits *inside* it on purpose: the backend login
            (tokens) is per user too, so it must re-restore for each one. */}
        <SessionBoundary>
          <AuthProvider>
            <ReadingProvider>
              <ThemeSync />
              <DevLoginGate>
                <TopNav />
                {children}
                <Footer />
              </DevLoginGate>
              <ToastHost />
            </ReadingProvider>
          </AuthProvider>
        </SessionBoundary>
      </body>
    </html>
  );
}
