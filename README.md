# Habitat Learn homepage rebuild

A Next.js (App Router, TypeScript, Tailwind CSS v3) rebuild of the [habitatlearn.com](https://habitatlearn.com)
homepage. It is built to be edited visually in [Onlook](https://onlook.com) and translated with
[Crowdin](https://crowdin.com).

## Run locally

Requires Node 20+ (developed on Node 25).

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (must pass before merging)
npm run start    # serve the production build
npm run lint     # ESLint
npm run format   # Prettier (also sorts Tailwind classes)
```

## Deploy to Vercel

No configuration is needed.

1. Push this repo to GitHub.
2. In Vercel choose **Add New → Project** and import the repo.
3. Keep the detected **Next.js** framework preset and click **Deploy**.

Every pull request gets a preview URL automatically. Open Graph image URLs use
`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets for you.

Optional environment variable: `SITE_LOCALE` (defaults to `en`), the locale folder to render.

## Project structure

```
app/                 layout (fonts, metadata, nav + footer) and page.tsx (assembles sections)
components/home/     one component per homepage section: Hero, Values, Products, Blog, Contact
components/layout/   Nav, Footer, PromoTile (shared across pages)
components/ui/       small primitives: Section, SectionHeader, SectionLabel, Label, Button, Icons, BackgroundVideo
locales/en/          ALL user-facing English text: home.json (sections) and common.json (nav, footer, meta)
i18n/request.ts      loads the locale's JSON files for next-intl
lib/links.ts         every outbound link (currently pointing at the live site)
public/images|video  local copies of every image and video used
tailwind.config.ts   design tokens (colors, type scale, spacing, radii, shadows, breakpoints)
```

## Design tokens

Tokens mirror the Webflow site's variables and live in `tailwind.config.ts` (with responsive values in
`app/globals.css`):

| Token | Example |
| --- | --- |
| Colors | `bg-brand-purple`, `text-brand-green`, `bg-canvas`, `bg-paper`, `bg-lift` |
| Type scale | `text-h1` … `text-h6`, `text-body-lg`, `text-body`, `text-body-sm`, `text-label` |
| Fonts | `font-heading` (PP Woodland), `font-body` (Manrope) |
| Section spacing | `pt-section-md`, `pb-section-lg`, `px-page` |
| Breakpoints | mobile `<768`, `md` ≥768 (tablet), `lg` ≥992 (desktop): same as Webflow |

Type and spacing tokens switch to their mobile values below 768px automatically.

## Translations (Crowdin)

All English copy and image alt text lives in `locales/en/*.json`. `crowdin.yml` maps those files to
`locales/<lang>/`. To add a language:

1. Add `locales/fr/home.json` and `locales/fr/common.json` (Crowdin will generate them).
2. Build with `SITE_LOCALE=fr`.

Serving several languages from one deployment (`/fr` URLs) needs `next-intl` routing (an `app/[locale]`
segment plus middleware). That is not set up yet, because this repo only covers the homepage.

## Editing in Onlook

Styling is plain Tailwind classes on JSX elements, so Onlook can edit it directly. Text renders from
`locales/`, so change copy there, not in the JSX.

## Notes

- **Fonts:** PP Woodland is a licensed font, self-hosted from `app/fonts/`. Manrope loads through `next/font/google`.
- **Form:** the contact form is a static placeholder (see the `TODO` in `components/home/Contact.tsx`).
- **Analytics, cookie banner, page loader and GSAP/Lenis interactions** from the Webflow site are intentionally not
  included. Scroll-in fades and the sticky product cards are done in CSS.
