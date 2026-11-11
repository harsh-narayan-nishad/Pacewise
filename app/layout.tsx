import type { Metadata, Viewport } from "next";
import { BRAND_NAME } from "@/lib/brand";
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
import { PresenceTracker } from "@/components/Session/PresenceTracker";
import { TopNav } from "@/components/Navigation/TopNav";
import { Footer } from "@/components/Footer/Footer";
import { NavLoaderProvider } from "@/contexts/NavLoaderContext";
import { DevLoginGate } from "@/components/Auth/DevLoginGate";
import { ToastHost } from "@/components/ui/ToastHost";
import { AuthProvider } from "@/lib/api/AuthContext";
import { SessionBoundary } from "@/components/Session/SessionBoundary";

export const metadata: Metadata = {
  metadataBase: new URL("https://pacewise-backend-o4qu.onrender.com/api/v1"),
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: "Improve your English reading speed, comprehension, and focus.",
  applicationName: BRAND_NAME,
  openGraph: { title: BRAND_NAME, description: "Improve your English reading speed, comprehension, and focus.", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ color: "#0b0c0e" }],
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
              <PresenceTracker />
              <DevLoginGate>
                {/* Keyboard users can jump past the navbar. Visible only while focused. */}
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
                >
                  Skip to content
                </a>
                <NavLoaderProvider>
                  <TopNav />
                  <main id="main">{children}</main>
                  <Footer />
                </NavLoaderProvider>
              </DevLoginGate>
              <ToastHost />
            </ReadingProvider>
          </AuthProvider>
        </SessionBoundary>
      </body>
    </html>
  );
}
