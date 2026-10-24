import SunLoader from "@/components/ui/loaders/SunLoader";

/**
 * Every route guards on `state.story` being loaded before rendering (see
 * app/page.tsx, app/reader/page.tsx, app/questions/page.tsx,
 * app/results/page.tsx) — previously each just returned `null` for that
 * instant, which is a blank flash rather than a loading state. Centralized
 * here so all four routes show the same loader instead of four copies of
 * the same wrapper markup.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <SunLoader />
    </div>
  );
}
