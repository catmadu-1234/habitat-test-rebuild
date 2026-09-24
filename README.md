# Habitat Learn homepage rebuild

A Next.js (App Router, TypeScript, Tailwind CSS v3) rebuild of the [habitatlearn.com](https://habitatlearn.com)
homepage. Layout and styling are edited in [Onlook](https://onlook.com); all copy, images and links are
edited in [Sanity](https://www.sanity.io) (with click-to-edit in the Presentation tool).

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
npm test         # unit tests (node --test)
npm run typegen  # regenerate sanity.types.ts from the Studio schema and the site's GROQ queries
```

## Content (Sanity)

Content is in Sanity project `uruh3czl`, dataset `production`. The Studio is a separate app in the sibling
folder `../studio-habitat-learn-test`:

```bash
cd ../studio-habitat-learn-test
npm run dev          # http://localhost:3333 (Structure, Presentation, Vision)
npx sanity deploy    # publish the Studio to <name>.sanity.studio
```

Environment for this app (`.env.local` locally, `.dev.vars` for `npm run cf:preview`, Workers secrets in production):

| Variable                        | Purpose                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SANITY_API_READ_TOKEN`         | **Viewer** (read-only) token. Needed for Draft Mode/Presentation. In Draft Mode it is also sent to the browser (so drafts update live), which is why it must be Viewer-only.                                       |
| `SANITY_REVALIDATE_SECRET`      | Secret shared with the Sanity publish webhook (see below).                                                                                                                                                         |
| `NEXT_PUBLIC_SANITY_STUDIO_URL` | Deployed Studio URL, used for click-to-edit links. It is inlined at **build** time, so set it in `.env.local` before `npm run cf:build`/`cf:deploy`, not as a Workers secret. Defaults to `http://localhost:3333`. |

Set the secrets on Cloudflare with `npx wrangler secret put SANITY_API_READ_TOKEN` and `npx wrangler secret put SANITY_REVALIDATE_SECRET`. Add each site origin to
Sanity CORS with credentials (`npx sanity cors add <origin> --credentials` in the Studio folder).

## Deploy to Vercel

No configuration is needed.

1. Push this repo to GitHub.
2. In Vercel choose **Add New → Project** and import the repo.
3. Keep the detected **Next.js** framework preset and click **Deploy**.

Every pull request gets a preview URL automatically. Open Graph image URLs use
`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets for you.

### Deploy to Cloudflare (Workers)

Cloudflare Pages is being replaced by Workers for Next.js, so this repo uses the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) (config: `wrangler.jsonc`,
`open-next.config.ts`).

```bash
npx wrangler login          # once
npm run cf:preview          # build + run locally in the Workers runtime
npm run cf:deploy           # build + deploy; prints https://<name>.<account>.workers.dev
```

Image optimization uses the Cloudflare Images binding (`IMAGES` in `wrangler.jsonc`). Cached pages and their
invalidation records live in two KV namespaces (`NEXT_INC_CACHE_KV`, `NEXT_TAG_CACHE_KV`, configured in
`open-next.config.ts` and `wrangler.jsonc`), which is how a Sanity publish reaches the deployed site. To deploy from Git
instead, connect the repo in the Cloudflare dashboard (Workers & Pages → Create → Import a repository) with build
command `npx opennextjs-cloudflare build` and deploy command `npx opennextjs-cloudflare deploy`.

## Project structure

```
app/                 layout (fonts, metadata, nav + footer) and page.tsx (assembles sections)
components/home/     one component per homepage section: Hero, Values, Products, Blog, Contact
components/layout/   Nav, Footer, PromoTile (shared across pages)
components/ui/       small primitives: Section, SectionHeader, SectionLabel, Label, Button, Icons, BackgroundVideo
sanity/              Sanity client, live fetching, image URLs and the GROQ queries (queries.ts)
sanity.types.ts      generated types (npm run typegen)
lib/                 small helpers (cn, formatPostDate)
public/images|video  static UI assets only: icons, logos, posters, hero and nav videos
tailwind.config.ts   design tokens (colors, type scale, spacing, radii, shadows, breakpoints)
```

### Publishing reaches the live site

Visitors' browsers get live updates through `<SanityLive />`, but an editor publishing from Presentation is in Draft
Mode and no one else may have the site open. So a Sanity **webhook** also calls `POST /api/revalidate` on publish
(signed with `SANITY_REVALIDATE_SECRET`), which expires every cached Sanity fetch. Create it in Sanity Manage →
API → Webhooks: URL `https://<site>/api/revalidate`, dataset `production`, trigger on create/update/delete, filter
`_type in ["homePage", "siteSettings", "post"]`, HTTP method POST, and the same secret.

### Where things are deployed

- Site: https://habitat-test-rebuild.jake-cogan.workers.dev (Cloudflare Workers)
- Studio: https://habitat-learn.sanity.studio (`npx sanity deploy` in the Studio folder; its Presentation tool previews the site above)
- A publish webhook (Sanity Manage → API → Webhooks, "Habitat site: revalidate on publish") calls `/api/revalidate`. On real
  Cloudflare KV a publish takes about a minute to show on the site.

## Design tokens

Tokens mirror the Webflow site's variables and live in `tailwind.config.ts` (with responsive values in
`app/globals.css`):

| Token           | Example                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| Colors          | `bg-brand-purple`, `text-brand-green`, `bg-canvas`, `bg-paper`, `bg-lift`        |
| Type scale      | `text-h1` … `text-h6`, `text-body-lg`, `text-body`, `text-body-sm`, `text-label` |
| Fonts           | `font-heading` (PP Woodland), `font-body` (Manrope)                              |
| Section spacing | `pt-section-md`, `pb-section-lg`, `px-page`                                      |
| Breakpoints     | mobile `<768`, `md` ≥768 (tablet), `lg` ≥992 (desktop): same as Webflow          |

Type and spacing tokens switch to their mobile values below 768px automatically.

## Languages

The site is English only. Content documents are `homePage-en` and `siteSettings-en`, so a second language is a
new pair of documents plus locale routing, not a migration. Crowdin and `next-intl` were removed when copy moved
to Sanity.

## Editing in Onlook

Styling is plain Tailwind classes on JSX elements, so Onlook can edit it directly. Text, images and links render
from Sanity, so change those in the Studio, not in the JSX.

## Notes

- **Fonts:** PP Woodland is a licensed font, self-hosted from `app/fonts/`. Manrope loads through `next/font/google`.
- **Form:** the contact form is a static placeholder (see the `TODO` in `components/home/Contact.tsx`).
- **Analytics, cookie banner, page loader and GSAP/Lenis interactions** from the Webflow site are intentionally not
  included. Scroll-in fades and the sticky product cards are done in CSS.
