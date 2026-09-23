import type { Config } from "tailwindcss";

// Design tokens mirror the Webflow site's variables (habitatlearn.com).
// Breakpoints follow Webflow's: mobile < 768, tablet 768-991, desktop >= 992.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "992px",
    },
    extend: {
      colors: {
        "brand-purple": "#382340", // deep-focus: text, primary buttons, dark surfaces
        "brand-green": "#378960", // growth-path: primary CTA, footer
        "brand-lilac": "#907299", // insight-lilac
        canvas: "#f4f4f4", // quiet-canvas: page/section background
        paper: "#f7f7f2", // warm off-white: nav, cards on dark
        lift: "#e2e2e4", // raised grey surfaces (labels, cards)
        depth: "#e1dcd5",
        "ui-error": "#c94040",
        "ui-success": "#2ad87f",
        "ui-warning": "#c56a21",
      },
      opacity: {
        4: "0.04",
        8: "0.08",
        16: "0.16",
        32: "0.32",
        48: "0.48",
        64: "0.64",
        88: "0.88",
      },
      fontFamily: {
        heading: ["var(--font-woodland)", "Georgia", "serif"],
        body: ["var(--font-manrope)", "sans-serif"],
      },
      // Type scale. Sizes switch to their mobile values below 768px via the
      // CSS variables in app/globals.css.
      fontSize: {
        h1: ["var(--fs-h1)", { lineHeight: "var(--lh-h1)", letterSpacing: "var(--ls-h1)" }],
        h2: ["var(--fs-h2)", { lineHeight: "var(--lh-h2)", letterSpacing: "var(--ls-h2)" }],
        h3: ["var(--fs-h3)", { lineHeight: "var(--lh-h3)", letterSpacing: "var(--ls-h3)" }],
        h4: ["var(--fs-h4)", { lineHeight: "var(--lh-h4)", letterSpacing: "var(--ls-h4)" }],
        h6: ["var(--fs-h6)", { lineHeight: "var(--lh-h6)", letterSpacing: "var(--ls-h6)" }],
        "body-lg": ["var(--fs-body-1)", { lineHeight: "var(--lh-body-1)" }],
        body: ["var(--fs-body-2)", { lineHeight: "var(--lh-body-2)" }],
        "body-sm": ["var(--fs-body-3)", { lineHeight: "var(--lh-body-3)" }],
        button: ["var(--fs-button)", { lineHeight: "var(--lh-button)" }],
        label: ["var(--fs-label)", { lineHeight: "var(--lh-label)", letterSpacing: "0.75px" }],
        "label-sm": [
          "var(--fs-label-sm)",
          { lineHeight: "var(--lh-label-sm)", letterSpacing: "0.75px" },
        ],
      },
      // Section spacing mirrors Webflow's section-padding variables and
      // switches to its mobile value below 768px (see app/globals.css).
      spacing: {
        "section-sm": "var(--section-sm)",
        "section-md": "var(--section-md)",
        "section-lg": "var(--section-lg)",
        page: "var(--page-pad)",
        content: "132px", // large gap between the two halves of a layout
      },
      maxWidth: {
        page: "1800px", // outer container
        headline: "680px", // centered/left section headlines
        products: "1144px", // product card row
        widget: "391px", // hero "notes are ready" widget
      },
      borderRadius: {
        card: "12px",
        button: "16px",
        panel: "16px",
        pill: "24px",
      },
      boxShadow: {
        // Subtle top/bottom highlight used on all buttons.
        button: "0 -1px 0 0 rgba(247,247,242,0.16), 0 1px 0 0 rgba(247,247,242,0.08)",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "fade-up": "fade-up 0.8s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
