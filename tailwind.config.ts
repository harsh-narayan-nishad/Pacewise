import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Reader text keeps its own serif option (user setting) — only the app chrome follows Render.
        serif: ["'Source Serif 4'", "ui-serif", "Georgia", "serif"],
        // render.com: PP Neue Montreal (UI/body), Roobert (display), PP Neue Montreal Mono (code).
        // Those are licensed fonts, so they are listed first (used if installed) and
        // Inter / JetBrains Mono, Render's own fallbacks, are what actually load.
        sans: ["'PP Neue Montreal'", "'Inter'", "'Söhne'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Roobert'", "'Inter'", "'Söhne'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'PP Neue Montreal Mono'", "'JetBrains Mono'", "'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      // Render's type scale (size / line-height / tracking).
      fontSize: {
        xs: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        sm: ["14px", { lineHeight: "20px", letterSpacing: "0" }],
        base: ["16px", { lineHeight: "24px", letterSpacing: "0.01em" }],
        lg: ["18px", { lineHeight: "26px", letterSpacing: "0.005em" }],
        xl: ["20px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.01em" }],
        "3xl": ["32px", { lineHeight: "37px", letterSpacing: "-0.025em" }],
        "4xl": ["40px", { lineHeight: "44px", letterSpacing: "-0.015em" }],
        "5xl": ["48px", { lineHeight: "51px", letterSpacing: "-0.02em" }],
        "6xl": ["64px", { lineHeight: "67px", letterSpacing: "-0.025em" }],
        "7xl": ["80px", { lineHeight: "80px", letterSpacing: "-0.03em" }],
      },
      colors: {
        // Theme-aware tokens: driven by CSS custom properties in
        // globals.css and swapped in one place via `data-theme` on <html>.
        // The `<alpha-value>` placeholder lets normal Tailwind opacity
        // modifiers keep working, e.g. `border-overlay/10`, `bg-canvas/80`.
        canvas: {
          DEFAULT: "rgb(var(--canvas) / <alpha-value>)",
          raised: "rgb(var(--canvas-raised) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        // Generic foreground-tinted overlay used for hairline borders,
        // dividers, and hover backgrounds — automatically light-on-dark
        // in the dark theme and dark-on-light in light/sepia.
        overlay: "rgb(var(--overlay) / <alpha-value>)",
        // Semantic speed-band colors: intentionally constant across
        // themes since they encode meaning (slow/medium/fast/extreme),
        // not surface decoration.
        accent: {
          slow: "#5FA8D3",
          medium: "#7FC97F",
          fast: "#E8B84B",
          extreme: "#E05B5B",
        },
      },
      boxShadow: {
        themed: "0 8px 30px -6px rgb(var(--shadow-color) / 0.35)",
      },
      // A clean, deliberate stacking hierarchy (Phase 11 of the social-
      // features brief) replacing a grab-bag of arbitrary z-[N] values
      // sprinkled per component. Each tier is a named token so every new
      // dropdown/modal/overlay picks the right layer by name instead of a
      // guessed number — see README's "Z-index hierarchy" section for the
      // full ordering and which components use which tier. The two
      // existing bare Tailwind numbers already in the app (z-40 for
      // TopNav, z-50 for its dropdowns/tooltips) are left as-is since
      // they already sit correctly below everything here.
      zIndex: {
        "modal-backdrop": "100",
        drawer: "110",
        overlay: "150",
        toast: "200",
      },
      keyframes: {
        "scroll-up": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(var(--scroll-distance))" },
        },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "marquee-reverse": { from: { transform: "translateX(-50%)" }, to: { transform: "translateX(0)" } },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        marquee: "marquee 45s linear infinite",
        "marquee-reverse": "marquee-reverse 55s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
