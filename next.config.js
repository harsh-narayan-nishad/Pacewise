/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in the `X-Powered-By` header.
  poweredByHeader: false,
  // Required for styled-components (used by the two Loader components) to
  // hydrate with matching class names between server and client render —
  // a Next.js App Router config need, not a change to the loaders' own code.
  compiler: {
    styledComponents: true,
  },
  webpack: (config) => {
    // pdf.js optionally requires the native `canvas` package (Node only); the browser doesn't need it.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  // Lint in CI (`npm run lint`), not inside `next build`, so a style warning can't block a deploy.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Voice search needs the microphone on this origin; nothing else is used.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
        ],
      },
      {
        // Landing video: long-lived, immutable cache.
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

module.exports = nextConfig;
