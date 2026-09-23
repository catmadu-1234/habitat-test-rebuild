# Habitat Learn homepage: conventions for Claude

Next.js 16 (App Router, TypeScript) + Tailwind CSS **v3**. This is a rebuild of https://habitatlearn.com that
must stay easy to edit in Onlook and to translate in Crowdin. Follow these rules.

## Non-negotiables

1. **Tailwind classes only.** Style with utility classes directly on JSX elements. No CSS modules, CSS-in-JS,
   `@apply`, inline `style=`, or extra UI libraries (no shadcn, MUI, clsx, tailwind-merge). Onlook edits the
   classes in the JSX, so keep markup simple and readable.
2. **No hard-coded user-facing text.** Every visible string and every `alt`/`aria-label` lives in
   `locales/en/home.json` (sections) or `locales/en/common.json` (nav, footer, meta), and is rendered with
   `getTranslations` from `next-intl/server`. Keys are grouped by section.
3. **One component per homepage section** in `components/home/`, assembled in `app/page.tsx`.
   Shared chrome (Nav, Footer) goes in `components/layout/`. Small reusable pieces go in `components/ui/`.
4. **Local assets only.** Images in `public/images/<area>/`, video in `public/video/`. Never hotlink Webflow's
   CDN. Use `next/image` for images.
5. **Named tokens, not raw values.** Colors, type sizes, spacing, radii and shadows come from
   `tailwind.config.ts`. Never write a hex value in a component.

## Tokens (see `tailwind.config.ts`, `app/globals.css`)

- Colors: `brand-purple`, `brand-green`, `brand-lilac`, `canvas` (#f4f4f4), `paper` (#f7f7f2), `lift`, `depth`,
  `ui-*`. Opacity steps: `/4 /8 /16 /32 /48 /64 /88` (e.g. `text-brand-purple/64`).
- Type: `font-heading` + `text-h1|h2|h3|h4|h6`; `text-body-lg|body|body-sm|button|label|label-sm`. These are
  CSS-variable driven and shrink automatically below 768px, so don't add `md:` size overrides for them.
- Spacing: `pt|pb-section-sm|md|lg` (responsive), `px-page`, `gap-content`. Use the default Tailwind scale otherwise.
- Breakpoints (mobile-first, same as Webflow): base = mobile (<768), `md:` ≥768 tablet, `lg:` ≥992 desktop.
- Radii `rounded-card|button|panel|pill`, shadow `shadow-button`, widths `max-w-page|headline|products|widget`.
- Arbitrary values (`h-[362px]`) are for genuine one-off measurements only. If a value repeats, make it a token.

## Structure rules

- New section = new file in `components/home/`, wrapped in `<Section>` (background + container + section
  padding) and opened with `<SectionHeader>` where it has a label + heading. Reuse `Button`, `Label`,
  `SectionLabel`, `PromoTile` before writing new markup.
- Components are async server components using `getTranslations`. Only add `"use client"` for real
  interactivity (see `BackgroundVideo`). The nav menu and dropdowns are CSS-only (checkbox + `group-has`/hover).
- Outbound links live in `lib/links.ts`, and locale files reference copy by key.
- Conditional classes: use `cn()` from `lib/cn.ts`. Class strings must be complete literals (no
  `` `pt-${x}` ``), or Tailwind can't see them.
- Run `npm run format` (Prettier + Tailwind class sorting), `npm run lint` and `npm run build` before committing.
  `npm run build` must pass with no errors.

## Adding a language

Add `locales/<code>/home.json` and `common.json` with the same keys as `en`. Nothing in components changes.
See README for routing notes.

## Verifying visual changes

The reference is the live site. Compare at 1440px and 390px (and 820px for tablet). Section heights on the
live site at 1440 are: hero 1439, values 1087, products 1189, blog 928, CTA 839, footer 533.

## Known deviations from the live site

- Contact form is a static placeholder (TODO in `Contact.tsx`).
- The form's submit button stays visible on tablet/mobile (the live site hides it below 992px).
- Live copy typos are preserved on purpose in `home.json` (`thatremoves`, `highquality`, `empowerstudents`,
  `toreach`) and the CTA paragraph is the same color as its panel (invisible), as on live. Fix in both places if
  the live site is corrected.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
