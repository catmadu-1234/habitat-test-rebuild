# Sanity CMS + Visual Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Habitat Learn homepage editable in Sanity (copy, alt text, images, links, blog posts) with click-to-edit Presentation, with no visual change to the site.

**Architecture:** A standalone Sanity Studio lives in `studio/`. The Next.js site fetches published content through `next-sanity`'s `defineLive` (non-Cache-Components mode) and renders draft content plus click-to-edit overlays when Draft Mode is on. On Cloudflare Workers, OpenNext KV caches let a publish reach the deployed site. `locales/*.json` is imported into Sanity once, then removed along with `next-intl` and Crowdin.

**Tech Stack:** Next.js 16.3.6, React 19.2, Tailwind 3, `next-sanity@^13.3.4`, `@sanity/image-url@^2`, Sanity Studio `sanity@^6`, `@opennextjs/cloudflare@1.20.6`, Wrangler, Node 25 (`node --test` for unit tests), Playwright (visual diff, own package).

**Spec:** `docs/superpowers/specs/2026-09-24-sanity-cms-integration-design.md` (read it first; this plan implements it).

## Global Constraints

Every task's requirements include these.

- Tailwind utility classes only on JSX elements. No CSS modules, CSS-in-JS, `@apply`, inline `style=`, new UI libraries, or raw hex values. Use named tokens from `tailwind.config.ts`. Class strings are complete literals (no `` `pt-${x}` ``).
- No hard-coded user-facing text in components; all copy comes from Sanity. Only exception: the editor-only "Disable Draft Mode" button.
- One component per homepage section in `components/home/`, wrapped in `<Section>`; async server components; `"use client"` only for real interactivity.
- Sanity project `uruh3czl`, dataset `production`, API version `2026-09-01`. Singleton document IDs: `homePage-en` and `siteSettings-en`.
- `cacheComponents` stays **unset** in `next.config.ts`.
- Live-site typos in `home.json` (`thatremoves`, `highquality`, `empowerstudents`, `toreach`) are seeded **verbatim**.
- The hero video (`public/video/hero.webm`), the nav clip and its poster, fonts, favicons, SVG icons, `hero/grow.png` (decorative, in the Hero) and `bg/purple-background.png` stay local. Never serve video from Sanity `file` assets.
- Every image field is the `imageWithAlt` type with a required `alt`. Hotspot is enabled for the crop tool, but only crop is honoured on the site (inline `style` for `object-position` is banned).
- Strings that drive logic (URLs, keys, `lang`) go through `stegaClean`; `generateMetadata` uses `stega: false`.
- Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.
- Before every commit run `npm run format`, `npm run lint`, `npm run build` (all must pass). Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (pass it as a second `-m`).
- Never commit tokens or `.env*`/`.dev.vars`. The user creates Sanity tokens; never ask for them in chat.
- Steps marked **[USER-CONFIRM]** change an external account (Sanity dataset/CORS, Cloudflare KV, deploys). Stop and get an explicit yes first.

## Amendment (2026-09-24): the Studio stays in its sibling folder

Decided after the plan was written, following Sanity's own guidance ("keep the Studio standalone, next to the app"). **The Studio is NOT moved into this repo.** Read every `studio/` path in this plan with these substitutions:

- `WEB` = `/Users/jacobcogan/developer/habitat-rebuild-test` (this repo). `STUDIO` = `/Users/jacobcogan/developer/studio-habitat-learn-test` (its own git repo; keep its `.git`).
- `studio/…`, `(cd studio && …)` and `npm --prefix studio` mean `STUDIO/…`, `(cd ../studio-habitat-learn-test && …)` (from WEB) and `npm --prefix ../studio-habitat-learn-test`.
- **Task 2 is reduced to:** `npm pkg set name=habitat-learn-studio` in STUDIO, append `schema.json` to `STUDIO/.gitignore`, add `scripts/**` and `sanity.types.ts` to ESLint ignores and create `.prettierignore` in WEB (Steps 4–5), and verify `npx sanity build` in STUDIO. **Skip** the `mv`, `rm -rf .git`, `npm ci` and the `tsconfig` `exclude: ["studio"]` change (the Studio is not inside WEB). Studio files are committed in STUDIO's own repo (`git -C ../studio-habitat-learn-test …`), web files in WEB, each with the same `Co-Authored-By` trailer. Step 7's `git add studio` applies to STUDIO's repo.
- Path changes in STUDIO files: `sanity.cli.ts` typegen becomes `path: '../habitat-rebuild-test/{app,components,sanity}/**/*.{ts,tsx}'` and `generates: '../habitat-rebuild-test/sanity.types.ts'`; in `scripts/spike.ts`, the image path is `../habitat-rebuild-test/public/images/blog/wcag-compliance.jpg`; in `scripts/seed.ts` and `scripts/verify-seed.ts`, `repoRoot = path.resolve(process.cwd(), '../habitat-rebuild-test')` and the imports become `'../../habitat-rebuild-test/lib/links'` and `'../../habitat-rebuild-test/lib/format-post-date'`. (Both run with STUDIO as the working directory.)
- Root scripts: `typegen` = `npm --prefix ../studio-habitat-learn-test run typegen`, `seed` likewise.
- Task 12: delete `scripts/` in STUDIO and commit it there; the docs in WEB refer to `../studio-habitat-learn-test` instead of `studio/`.

## Review Focus

Failure modes the spec implies but the happy path won't exercise. Each is pinned to the task that owns the code.

1. **Post dates at month boundaries and in other time zones** (`2026-01-01`, `2026-12-31`, run under UTC±14): a card must never show the wrong month. → Task 4 tests.
2. **Missing or empty content:** an unseeded dataset must fail the build with a message that says to seed, while empty-string/`0`/`false` field values must render, not throw. → Task 4 tests.
3. **Zero or more than three `post` documents:** the blog section renders its header and button with no cards and never more than three cards. → Task 11 manual check.
4. **Stega characters leaking** into `href`s, `<head>` metadata or `lang` while in Draft Mode. → Task 13 check.
5. **An editor clears or replaces an image** (asset missing, or crop applied): `SanityImage` renders nothing rather than crashing, and cropped images still render. → Task 7 code path plus Task 13 manual check.

---

### Task 1: Branch and visual regression harness

**Files:**
- Create: `scripts/visual/package.json` (via npm), `scripts/visual/check.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `node scripts/visual/check.mjs capture <label> [baseUrl]` writes `.visual/<label>/{1440,820,390}.png` and `heights.json`; `node scripts/visual/check.mjs compare <baseline> <candidate>` exits 1 if any section height differs or more than 0.5% of pixels differ. Later tasks use these as their regression gate.

- [ ] **Step 1: Create the branch off the open PR branch**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test
git switch -c sanity-integration
```
Expected: `Switched to a new branch 'sanity-integration'`.

- [ ] **Step 2: Create the harness package (own `node_modules`, so root installs never prune it)**

```bash
mkdir -p scripts/visual && cd scripts/visual
npm init -y >/dev/null
npm pkg set name=visual-check private=true type=module
npm install playwright pixelmatch pngjs
```

- [ ] **Step 3: Write `scripts/visual/check.mjs`**

```js
// Visual regression helper for the Sanity migration.
//   node check.mjs capture <label> [baseUrl]      writes ../../.visual/<label>/
//   node check.mjs compare <baseline> <candidate> exits 1 on any difference beyond tolerance
// Needs CHROME_PATH pointing at a Chromium binary (see the plan, Task 1).
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.visual");
const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
];
const maxDiffRatio = 0.005;

// Freeze scroll-in animations and the marquee, and hide videos, so runs are repeatable.
const freeze = `
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  video { visibility: hidden !important; }
`;

async function capture(label, baseUrl = "http://localhost:3100") {
  const dir = path.join(outRoot, label);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const heights = {};

  for (const { width, height } of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: freeze });
    // Scroll through the page so lazy images load, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    heights[width] = await page.evaluate(() =>
      [...document.querySelectorAll("main > section, footer")].map((el) =>
        Math.round(el.getBoundingClientRect().height),
      ),
    );
    await page.screenshot({ path: path.join(dir, `${width}.png`), fullPage: true });
    await page.close();
  }

  await browser.close();
  writeFileSync(path.join(dir, "heights.json"), JSON.stringify(heights, null, 2));
  console.log(`${label}: ${JSON.stringify(heights)}`);
}

function compare(baseline, candidate) {
  let failed = false;
  const heightsA = JSON.parse(readFileSync(path.join(outRoot, baseline, "heights.json"), "utf8"));
  const heightsB = JSON.parse(readFileSync(path.join(outRoot, candidate, "heights.json"), "utf8"));

  for (const { width } of viewports) {
    if (JSON.stringify(heightsA[width]) !== JSON.stringify(heightsB[width])) {
      console.log(`${width}: section heights differ ${heightsA[width]} vs ${heightsB[width]}`);
      failed = true;
    }
    const a = PNG.sync.read(readFileSync(path.join(outRoot, baseline, `${width}.png`)));
    const b = PNG.sync.read(readFileSync(path.join(outRoot, candidate, `${width}.png`)));
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`${width}: page size differs ${a.width}x${a.height} vs ${b.width}x${b.height}`);
      failed = true;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const ratio = changed / (a.width * a.height);
    writeFileSync(path.join(outRoot, candidate, `diff-${width}.png`), PNG.sync.write(diff));
    console.log(`${width}: ${changed} px differ (${(ratio * 100).toFixed(3)}%)`);
    if (ratio > maxDiffRatio) failed = true;
  }

  console.log(failed ? "FAIL" : "PASS");
  process.exit(failed ? 1 : 0);
}

const [command, ...args] = process.argv.slice(2);
if (command === "capture") await capture(...args);
else if (command === "compare") compare(...args);
else {
  console.error("usage: check.mjs capture <label> [baseUrl] | compare <baseline> <candidate>");
  process.exit(2);
}
```

- [ ] **Step 4: Ignore generated output**

Append to `/.gitignore` (root):

```gitignore

# visual regression output and harness deps
/.visual/
/scripts/visual/node_modules

# wrangler local secrets
.dev.vars
```

- [ ] **Step 5: Build and serve the current site, capture the baseline twice (noise check)**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test
export CHROME_PATH="$(find ~/Library/Caches/ms-playwright/chromium-1228 -name 'Google Chrome for Testing' -type f | head -1)"
echo "$CHROME_PATH"    # must print a path; if empty, run: ls ~/Library/Caches/ms-playwright
npm run build
npx next start -p 3100 &        # leave running
sleep 4
node scripts/visual/check.mjs capture baseline
node scripts/visual/check.mjs capture baseline-2
node scripts/visual/check.mjs compare baseline baseline-2
```
Expected: `PASS` with well under 0.5% difference, and 1440 heights `[1439,1087,1189,928,839,533]` (the CLAUDE.md numbers). If `baseline` vs `baseline-2` fails, the harness is too noisy: fix the harness (more freezing) before continuing. Stop the server afterwards (`kill %1`).

- [ ] **Step 6: Commit**

```bash
git add scripts/visual/check.mjs scripts/visual/package.json scripts/visual/package-lock.json .gitignore
git commit -m "test: add visual regression harness" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Move the Studio into the repo

**Files:**
- Move: `/Users/jacobcogan/developer/studio-habitat-learn-test` → `studio/`
- Modify: `tsconfig.json`, `eslint.config.mjs`, `studio/package.json`, `studio/.gitignore`
- Create: `.prettierignore`

**Interfaces:**
- Produces: a self-contained `studio/` app (own `package.json`, `sanity.config.ts`, `sanity.cli.ts`, `schemaTypes/`), ignored by the site's TypeScript, ESLint and Prettier docs rules.

- [ ] **Step 1: Move it in and drop the nested git repo**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test
mv ../studio-habitat-learn-test ./studio
rm -rf studio/.git studio/node_modules
(cd studio && npm ci)
```
Expected: `npm ci` succeeds. `git status` shows `studio/` as untracked (no "embedded repository" warning).

- [ ] **Step 2: Rename the package and ignore generated schema output**

```bash
(cd studio && npm pkg set name=habitat-learn-studio)
printf '\n# TypeGen intermediate\nschema.json\n' >> studio/.gitignore
```

- [ ] **Step 3: Exclude `studio/` from the site's TypeScript**

In `tsconfig.json` change the last line of the file's `exclude`:

```json
  "exclude": ["node_modules", "studio"]
```

- [ ] **Step 4: Exclude studio, scripts and generated types from ESLint**

In `eslint.config.mjs` replace the `globalIgnores([...])` array with:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the site bundle:
    "studio/**",
    "scripts/**",
    "sanity.types.ts",
  ]),
```

- [ ] **Step 5: Keep Prettier off docs and generated files**

Create `.prettierignore`:

```
docs/
sanity.types.ts
```
(`studio/` keeps its own Prettier config in `studio/package.json`; Prettier 3 also skips anything in `.gitignore`.)

- [ ] **Step 6: Verify both apps still build**

```bash
npm run format && npm run lint && npm run build
(cd studio && npx sanity build)
```
Expected: root build passes with the same route table as before; `sanity build` finishes with "Build Sanity Studio" success. `npm run format` must not have modified any file under `studio/` in a surprising way (check `git status`).

- [ ] **Step 7: Commit**

```bash
git add studio tsconfig.json eslint.config.mjs .prettierignore
git commit -m "chore: move Sanity Studio into the repo as studio/" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Sanity foundation and the Cloudflare gate (spike)

**This task decides approach A vs B (spec section 3).** It builds the real data layer (kept if the gate passes) plus a throwaway `/spike` page and document.

**Files:**
- Create: `sanity/env.ts`, `sanity/lib/client.ts`, `sanity/lib/live.ts`, `sanity/lib/image.ts`, `app/api/draft-mode/enable/route.ts`, `app/api/draft-mode/disable/route.ts`, `components/ui/DisableDraftMode.tsx`
- Create (throwaway): `app/spike/page.tsx`, `studio/schemaTypes/spike.ts`, `studio/scripts/spike.ts`, `docs/superpowers/plans/2026-09-24-sanity-spike-results.md`
- Modify: `package.json`, `app/layout.tsx`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `studio/sanity.config.ts`, `studio/schemaTypes/index.ts`

**Interfaces:**
- Produces (used by every later task): `sanityFetch({ query, params?, stega? })` and `<SanityLive />` from `@/sanity/lib/live`; `client` from `@/sanity/lib/client`; `urlFor(source: SanityImageSource)` from `@/sanity/lib/image`; env exports `projectId`, `dataset`, `apiVersion`, `studioUrl`, `readToken` from `@/sanity/env`.

- [ ] **Step 1: Install dependencies**

```bash
npm install next-sanity@^13.3.4 @sanity/image-url@^2
```
Expected: succeeds. Note: `next-sanity` has hard peers on `sanity` and `styled-components`, so npm installs them into the web app too. They are only used by `next-sanity/studio`, which we never import, so they stay out of the bundle. Record `du -sh node_modules/sanity` in the results file for reference.

- [ ] **Step 2: Add `sanity/env.ts`**

```ts
// Project id and dataset are public identifiers, so they have safe defaults here.
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "uruh3czl";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
export const apiVersion = "2026-09-01";

// Where the Studio lives (used for stega click-to-edit links). Set to the deployed Studio URL in production.
export const studioUrl = process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ?? "http://localhost:3333";

// Viewer token: server only. Needed for Draft Mode; published content works without it.
export const readToken = process.env.SANITY_API_READ_TOKEN;
```

- [ ] **Step 3: Add `sanity/lib/client.ts`, `live.ts`, `image.ts`**

`sanity/lib/client.ts`:
```ts
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, studioUrl } from "@/sanity/env";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  // sanityFetch only turns stega (click-to-edit encoding) on while Draft Mode is active.
  stega: { studioUrl },
});
```

`sanity/lib/live.ts`:
```ts
import { defineLive } from "next-sanity/live";
import { readToken } from "@/sanity/env";
import { client } from "./client";

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: readToken,
  browserToken: readToken,
});
```

`sanity/lib/image.ts`:
```ts
import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url";
import { dataset, projectId } from "@/sanity/env";

const builder = createImageUrlBuilder({ projectId, dataset });

export const urlFor = (source: SanityImageSource) => builder.image(source);
```

- [ ] **Step 4: Add the Draft Mode routes and the exit button**

`app/api/draft-mode/enable/route.ts` (built lazily so a missing token can't break `next build`):
```ts
import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { readToken } from "@/sanity/env";
import { client } from "@/sanity/lib/client";

export async function GET(request: Request) {
  if (!readToken) {
    return new Response("SANITY_API_READ_TOKEN is not set", { status: 500 });
  }
  return defineEnableDraftMode({ client: client.withConfig({ token: readToken }) }).GET(request);
}
```

`app/api/draft-mode/disable/route.ts`:
```ts
import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  (await draftMode()).disable();
  return NextResponse.redirect(new URL("/", request.url));
}
```

`components/ui/DisableDraftMode.tsx` (editor-only tooling, so its label is the one allowed hard-coded string):
```tsx
"use client";

import { useVisualEditingEnvironment } from "next-sanity/hooks";

// Lets an editor leave Draft Mode when viewing the site outside Presentation.
export default function DisableDraftMode() {
  const environment = useVisualEditingEnvironment();
  if (environment !== "standalone") return null;

  return (
    <a
      href="/api/draft-mode/disable"
      className="fixed bottom-4 right-4 z-[999] rounded-button bg-brand-purple px-3 py-2 text-button text-paper shadow-button"
    >
      Disable Draft Mode
    </a>
  );
}
```

- [ ] **Step 5: Wire the layout**

In `app/layout.tsx` add imports and change the body (keep the rest of the file as is):
```tsx
import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import DisableDraftMode from "@/components/ui/DisableDraftMode";
import { SanityLive } from "@/sanity/lib/live";
```
```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <html lang={locale} className={`${manrope.variable} ${woodland.variable}`}>
      <body className="bg-paper font-body text-body text-brand-purple/88 antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
        <SanityLive />
        {isDraftMode && (
          <>
            <DisableDraftMode />
            <VisualEditing />
          </>
        )}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Allow Sanity's CDN in `next/image`**

In `next.config.ts` change `images` to:
```ts
  images: {
    // 75 is the default; 90 is used for photos (see quality={90}).
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
```

- [ ] **Step 7: Throwaway Studio type and spike document**

`studio/schemaTypes/spike.ts`:
```ts
import {defineField, defineType} from 'sanity'

export const spike = defineType({
  name: 'spike',
  title: 'Spike',
  type: 'document',
  fields: [
    defineField({name: 'title', type: 'string'}),
    defineField({name: 'image', type: 'image'}),
  ],
})
```
`studio/schemaTypes/index.ts`:
```ts
import {spike} from './spike'

export const schemaTypes = [spike]
```
`studio/scripts/spike.ts`:
```ts
import {createReadStream} from 'node:fs'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-09-01'})

async function main() {
  const asset = await client.assets.upload(
    'image',
    createReadStream('../public/images/blog/wcag-compliance.jpg'),
    {filename: 'spike.jpg'},
  )
  await client.createOrReplace({
    _id: 'spike',
    _type: 'spike',
    title: 'Spike v1',
    image: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}},
  })
  console.log('spike document written')
}

main()
```
Add Presentation to `studio/sanity.config.ts` (final version arrives in Task 5):
```ts
import {presentationTool} from 'sanity/presentation'
```
and in `plugins`:
```ts
    presentationTool({
      previewUrl: {
        origin: process.env.SANITY_STUDIO_PREVIEW_ORIGIN || 'http://localhost:3000',
        previewMode: {enable: '/api/draft-mode/enable'},
      },
    }),
```

- [ ] **Step 8: Throwaway spike page**

`app/spike/page.tsx`:
```tsx
import Image from "next/image";
import { defineQuery } from "next-sanity";
import { urlFor } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";

const SPIKE_QUERY = defineQuery(`*[_id == "spike"][0]{title, image}`);

export default async function SpikePage() {
  const { data } = await sanityFetch({ query: SPIKE_QUERY });

  return (
    <div className="p-8">
      <h1 className="text-h3">{data?.title}</h1>
      {data?.image && <Image src={urlFor(data.image).url()} alt="" width={400} height={300} />}
    </div>
  );
}
```

- [ ] **Step 9: [USER-CONFIRM] Create the token, write the spike document, allow CORS**

Ask the user to: (a) in Sanity Manage → project `uruh3czl` → API → Tokens, create a **Viewer** token; (b) create `.env.local` and `.dev.vars` in the repo root, both containing `SANITY_API_READ_TOKEN=<token>`. With the user's yes:
```bash
(cd studio && npx sanity exec scripts/spike.ts --with-user-token)
(cd studio && npx sanity cors add http://localhost:3000 --credentials)
(cd studio && npx sanity cors add http://localhost:8787 --credentials)
```
Expected: `spike document written`; both CORS origins added.

- [ ] **Step 10: Gate check 1: build and dev**

```bash
npm run format && npm run lint && npm run build
```
Expected: build succeeds. In the route table `/` must still be static (`○`). If the build fails mentioning `cacheTag`, `cacheLife` or `cacheComponents`, the Cache Components build of `next-sanity/live` was selected: record FAIL and go to Task 3B. Then:
```bash
npm run dev
```
Open `http://localhost:3000/spike`: shows "Spike v1" and the image. Record PASS/FAIL.

- [ ] **Step 11: Gate check 2: Presentation in dev**

```bash
(cd studio && npm run dev)     # http://localhost:3333
```
Open Studio → Presentation, navigate to `/spike`. Expected: the site loads in the iframe, hovering the heading shows an edit overlay, clicking opens the `title` field, editing it updates the preview live. Record PASS/FAIL.

- [ ] **Step 12: [USER-CONFIRM] Gate check 3: Cloudflare Workers runtime with KV caches**

With the user's yes, create the two KV namespaces (changes the Cloudflare account) and note the ids:
```bash
npx wrangler kv namespace create NEXT_INC_CACHE_KV
npx wrangler kv namespace create NEXT_TAG_CACHE_KV
```
Replace `open-next.config.ts` with:
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: kvNextTagCache,
  queue: memoryQueue,
});
```
Add to `wrangler.jsonc` (using the ids printed above; the worker name matches the existing `name`):
```jsonc
  "kv_namespaces": [
    { "binding": "NEXT_INC_CACHE_KV", "id": "<id printed for NEXT_INC_CACHE_KV>" },
    { "binding": "NEXT_TAG_CACHE_KV", "id": "<id printed for NEXT_TAG_CACHE_KV>" }
  ],
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "habitat-test-rebuild" }]
```
Run:
```bash
npm run cf:preview
```
Expected: builds without type errors (if `defineCloudflareConfig` rejects an override, read `node_modules/@opennextjs/cloudflare/dist/api/config.d.ts` and fix the type mismatch). At `http://localhost:8787/spike`: heading and image render; the image request (`/_next/image?url=https%3A%2F%2Fcdn.sanity.io...`) returns 200. Record PASS/FAIL, and the worker size printed by the build.

- [ ] **Step 13: Gate check 4: publish propagation and draft mode on Workers**

With `cf:preview` still running: open `http://localhost:8787/spike` in a browser tab and leave it open (it holds the `<SanityLive />` connection). In Studio (started with `SANITY_STUDIO_PREVIEW_ORIGIN=http://localhost:8787 npm run dev` in `studio/`), edit the spike `title` and publish. Expected: within about a minute the open tab shows the new title after `refresh`/navigation (v13 is "less live" by default) and a fresh load shows it. Also confirm Presentation loads the Worker-served page with overlays (draft cookie set). Record PASS/FAIL.

- [ ] **Step 14: Record the decision**

Write `docs/superpowers/plans/2026-09-24-sanity-spike-results.md` with the five gate checks (build/static `/`, image optimisation on Workers, publish propagation, draft mode + Presentation, worker size), each PASS/FAIL with the observed evidence, and one line: `Decision: approach A` or `Decision: approach B`.
- All PASS → continue at Step 15.
- Any of checks 1, 3, 4 FAIL → do **Task 3B**, then continue at Step 15.

- [ ] **Step 15: Remove the throwaway pieces (keep the data layer)**

```bash
rm -rf app/spike studio/schemaTypes/spike.ts studio/scripts/spike.ts
printf "export const schemaTypes = []\n" > studio/schemaTypes/index.ts
(cd studio && npx sanity documents delete spike)
```
[USER-CONFIRM] before the last command (it deletes the spike document from the dataset).

- [ ] **Step 16: Verify and commit**

```bash
npm run format && npm run lint && npm run build
git add sanity app components next.config.ts open-next.config.ts wrangler.jsonc package.json package-lock.json studio/sanity.config.ts studio/schemaTypes docs/superpowers/plans
git commit -m "feat: add Sanity data layer, draft mode, and Cloudflare KV caches" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 3B: Fallback data layer (only if the Task 3 gate fails)

Replaces `sanity/lib/live.ts`, drops `<SanityLive />`, and adds a signed revalidation webhook. Everything else in the plan is unchanged: later tasks only use `sanityFetch({ query, params?, stega? })`.

**Files:** Modify `sanity/lib/live.ts`, `app/layout.tsx`; Create `app/api/revalidate/route.ts`.

- [ ] **Step 1: Replace `sanity/lib/live.ts`** with a tag-based fetch wrapper that has the same call shape:

```ts
import { draftMode } from "next/headers";
import { type QueryParams } from "next-sanity";
import { readToken } from "@/sanity/env";
import { client } from "./client";

// Every published fetch is tagged "sanity"; the webhook below revalidates that tag.
export async function sanityFetch<const Query extends string>({
  query,
  params = {},
  stega,
}: {
  query: Query;
  params?: QueryParams;
  stega?: boolean;
}) {
  const { isEnabled } = await draftMode();

  if (isEnabled && readToken) {
    const data = await client.fetch(query, params, {
      token: readToken,
      perspective: "drafts",
      useCdn: false,
      stega: stega ?? true,
    });
    return { data };
  }

  const data = await client.fetch(query, params, {
    stega: false,
    next: { revalidate: false, tags: ["sanity"] },
  });
  return { data };
}

// Rendered by the layout only in the primary approach; a no-op here.
export function SanityLive() {
  return null;
}
```

- [ ] **Step 2: Add the signed webhook** `app/api/revalidate/route.ts`:

```ts
import { revalidateTag } from "next/cache";
import { parseBody } from "next-sanity/webhook";

export async function POST(request: Request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return new Response("Missing SANITY_REVALIDATE_SECRET", { status: 500 });

  const { isValidSignature } = await parseBody(request as never, secret, true);
  if (!isValidSignature) return new Response("Invalid signature", { status: 401 });

  revalidateTag("sanity", "max");
  return Response.json({ revalidated: "sanity" });
}
```

- [ ] **Step 3: Verify.** `npm run build`, then repeat Task 3 gate checks 3 and 4, replacing "open tab refreshes" with: publish in Studio, then `curl -X POST` is done by a Sanity webhook (**[USER-CONFIRM]**: create a webhook in Sanity Manage → API → Webhooks pointing at `<site>/api/revalidate` with the secret; add `SANITY_REVALIDATE_SECRET` to `.dev.vars`/Workers secrets). Update the results file with `Decision: approach B` and continue at Task 3, Step 15.

---

### Task 4: Pure helpers with tests (date formatting, missing-content guard)

**Files:**
- Create: `lib/format-post-date.ts`, `lib/format-post-date.test.ts`, `sanity/lib/assert-found.ts`, `sanity/lib/assert-found.test.ts`
- Modify: `package.json` (test script), `tsconfig.json`

**Interfaces:**
- Produces: `formatPostDate(date: string): string` (input `YYYY-MM-DD`, output like `Aug 2026`); `assertFound<T>(value: T | null | undefined, label: string): T` (throws for `null`/`undefined` only).

- [ ] **Step 1: Allow `.ts` import extensions (needed for Node's test runner) and add the script**

In `tsconfig.json` add inside `compilerOptions`:
```json
    "allowImportingTsExtensions": true,
```
In `package.json` add to `scripts`:
```json
    "test": "node --test lib/*.test.ts sanity/lib/*.test.ts",
```

- [ ] **Step 2: Write the failing tests**

`lib/format-post-date.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPostDate } from "./format-post-date.ts";

test("formats a date as short month and year", () => {
  assert.equal(formatPostDate("2026-08-01"), "Aug 2026");
  assert.equal(formatPostDate("2026-06-01"), "Jun 2026");
  assert.equal(formatPostDate("2026-05-01"), "May 2026");
});

test("does not shift the month at year boundaries", () => {
  assert.equal(formatPostDate("2026-01-01"), "Jan 2026");
  assert.equal(formatPostDate("2026-12-31"), "Dec 2026");
});

test("writes September as Sep", () => {
  assert.equal(formatPostDate("2026-09-15"), "Sep 2026");
});
```
`sanity/lib/assert-found.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFound } from "./assert-found.ts";

test("returns the value when present", () => {
  const value = { title: "x" };
  assert.equal(assertFound(value, "q"), value);
});

test("throws a seed hint for null and undefined", () => {
  assert.throws(() => assertFound(null, "*[_id == 'a'][0]"), /seed/i);
  assert.throws(() => assertFound(undefined, "q"), /seed/i);
});

test("treats empty string, 0 and false as real content", () => {
  assert.equal(assertFound("", "q"), "");
  assert.equal(assertFound(0, "q"), 0);
  assert.equal(assertFound(false, "q"), false);
});
```

- [ ] **Step 3: Run them and watch them fail**

```bash
npm test
```
Expected: FAIL: `Cannot find module './format-post-date.ts'` and `'./assert-found.ts'`.

- [ ] **Step 4: Implement**

`lib/format-post-date.ts`:
```ts
// Blog cards show month and year only ("Aug 2026"). Pinned to UTC so the month never
// shifts with the reader's or the server's time zone.
const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostDate(date: string): string {
  return formatter.format(new Date(`${date}T00:00:00Z`));
}
```
`sanity/lib/assert-found.ts`:
```ts
// Singleton content that is missing means the dataset was never seeded; fail loudly at build time.
export function assertFound<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `No Sanity content found for: ${label.trim()}\nHas the dataset been seeded? Run "npm run seed" in studio/.`,
    );
  }
  return value;
}
```

- [ ] **Step 5: Run the tests in three time zones**

```bash
npm test
TZ=Pacific/Honolulu npm test
TZ=Pacific/Kiritimati npm test
```
Expected: all PASS in each zone.

- [ ] **Step 6: Commit**

```bash
npm run format && npm run lint && npm run build
git add lib sanity package.json tsconfig.json
git commit -m "feat: add post date formatter and missing-content guard" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Studio schemas, structure, Presentation and TypeGen config

**Files (all under `studio/`):**
- Create: `schemaTypes/shared/fields.ts`, `schemaTypes/objects/{image-with-alt,nav-item,product-card,hero-section,values-section,products-section,blog-section,contact-section}.ts`, `schemaTypes/documents/{home-page,site-settings,post}.ts`, `singletons.ts`, `structure.ts`, `presentation/resolve.ts`
- Modify: `schemaTypes/index.ts`, `sanity.config.ts`, `sanity.cli.ts`, `package.json`
- Modify (root): `package.json`

**Interfaces:**
- Produces documents: `homePage` (`_id: "homePage-en"`) with `hero`, `values`, `products`, `blog`, `contact`; `siteSettings` (`_id: "siteSettings-en"`) with `meta`, `nav`, `footer`, `links`; `post` (`title`, `category`, `date`, `image`, `url`). The exact field names are the contract for Tasks 6-11 and mirror the JSON shape (see the code below). `npm run typegen` (root) regenerates `sanity.types.ts`.

- [ ] **Step 1: Install the icons package explicitly and add scripts**

```bash
(cd studio && npm install @sanity/icons)
(cd studio && npm pkg set scripts.typegen="sanity schema extract --enforce-required-fields --force && sanity typegen generate")
(cd studio && npm pkg set scripts.seed="sanity exec scripts/seed.ts --with-user-token")
(cd studio && npm pkg set scripts.verify-seed="sanity exec scripts/verify-seed.ts --with-user-token")
npm pkg set scripts.typegen="npm --prefix studio run typegen"
npm pkg set scripts.seed="npm --prefix studio run seed"
```

- [ ] **Step 2: Shared field helpers** `studio/schemaTypes/shared/fields.ts`

```ts
import {defineField, type FieldDefinition} from 'sanity'

export const stringField = (name: string, title: string) =>
  defineField({name, title, type: 'string', validation: (rule) => rule.required()})

export const textField = (name: string, title: string) =>
  defineField({name, title, type: 'text', rows: 3, validation: (rule) => rule.required()})

export const urlField = (name: string, title: string) =>
  defineField({
    name,
    title,
    type: 'url',
    validation: (rule) => rule.required().uri({scheme: ['https']}),
  })

export const imageField = (name: string, title: string) =>
  defineField({name, title, type: 'imageWithAlt', validation: (rule) => rule.required()})

export const navItemField = (name: string, title: string) =>
  defineField({name, title, type: 'navItem'})

export const objectField = (
  name: string,
  title: string,
  fields: FieldDefinition[],
  group?: string,
) => defineField({name, title, type: 'object', fields, group})
```

- [ ] **Step 3: Reusable object types**

`studio/schemaTypes/objects/image-with-alt.ts`:
```ts
import {defineField, defineType} from 'sanity'

export const imageWithAlt = defineType({
  name: 'imageWithAlt',
  title: 'Image',
  type: 'image',
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      description: 'Describe what the image shows, for screen readers.',
      validation: (rule) => rule.required(),
    }),
  ],
})
```
`studio/schemaTypes/objects/nav-item.ts`:
```ts
import {defineType} from 'sanity'
import {stringField} from '../shared/fields'

export const navItem = defineType({
  name: 'navItem',
  title: 'Nav item',
  type: 'object',
  fields: [stringField('label', 'Label'), stringField('description', 'Description')],
})
```
`studio/schemaTypes/objects/product-card.ts`:
```ts
import {defineType} from 'sanity'
import {imageField, stringField, textField} from '../shared/fields'

export const productCard = defineType({
  name: 'productCard',
  title: 'Product card',
  type: 'object',
  fields: [stringField('title', 'Title'), textField('description', 'Description'), imageField('image', 'Icon')],
})
```

- [ ] **Step 4: Homepage section object types**

`studio/schemaTypes/objects/hero-section.ts`:
```ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {imageField, objectField, stringField, textField} from '../shared/fields'

export const heroSection = defineType({
  name: 'heroSection',
  title: 'Hero',
  type: 'object',
  fields: [
    stringField('label', 'Label'),
    stringField('title', 'Title'),
    textField('description', 'Description'),
    stringField('primaryCta', 'Primary button label'),
    stringField('secondaryCta', 'Secondary button label'),
    stringField('trustedBy', 'Trusted-by line'),
    stringField('pauseVideo', 'Pause video button (screen reader label)'),
    stringField('playVideo', 'Play video button (screen reader label)'),
    defineField({
      name: 'avatars',
      title: 'Customer logos (round avatars)',
      type: 'array',
      of: [defineArrayMember({type: 'imageWithAlt'})],
      validation: (rule) => rule.required().min(1),
    }),
    imageField('teamImage', 'Team photo'),
    objectField('followUp', 'Follow-up email card', [
      stringField('title', 'Title'),
      stringField('message', 'Message'),
      stringField('sentBy', 'Sent by'),
    ]),
  ],
})
```
`studio/schemaTypes/objects/values-section.ts`:
```ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {imageField, stringField, textField} from '../shared/fields'

export const valuesSection = defineType({
  name: 'valuesSection',
  title: 'Values',
  type: 'object',
  fields: [
    stringField('label', 'Label'),
    stringField('title', 'Title'),
    imageField('image', 'Image'),
    defineField({
      name: 'items',
      title: 'Values',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'valueItem',
          fields: [stringField('title', 'Title'), textField('description', 'Description')],
          preview: {select: {title: 'title', subtitle: 'description'}},
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
})
```
`studio/schemaTypes/objects/products-section.ts`:
```ts
import {defineField, defineType} from 'sanity'
import {objectField, stringField, textField} from '../shared/fields'

const productCardField = (name: string, title: string) =>
  defineField({name, title, type: 'productCard'})

export const productsSection = defineType({
  name: 'productsSection',
  title: 'Products',
  type: 'object',
  fields: [
    stringField('label', 'Label'),
    stringField('title', 'Title'),
    textField('description', 'Description'),
    stringField('learnMore', 'Card link label'),
    objectField('items', 'Cards (fixed set, the layout is designed for these three)', [
      productCardField('messengerPigeon', 'Messenger Pigeon'),
      productCardField('podium', 'Podium Solution'),
      productCardField('liveServices', 'Live Services'),
    ]),
  ],
})
```
`studio/schemaTypes/objects/blog-section.ts`:
```ts
import {defineType} from 'sanity'
import {stringField} from '../shared/fields'

export const blogSection = defineType({
  name: 'blogSection',
  title: 'Blog',
  type: 'object',
  description: 'Blog cards come from the Blog posts documents (newest three).',
  fields: [
    stringField('label', 'Label'),
    stringField('title', 'Title'),
    stringField('nextPage', '"See more posts" button (screen reader label)'),
  ],
})
```
`studio/schemaTypes/objects/contact-section.ts`:
```ts
import {defineArrayMember, defineField, defineType} from 'sanity'
import {objectField, stringField, textField} from '../shared/fields'

export const contactSection = defineType({
  name: 'contactSection',
  title: 'Contact',
  type: 'object',
  fields: [
    stringField('title', 'Title'),
    textField('description', 'Description'),
    stringField('partnersLabel', 'Partner logos label'),
    defineField({
      name: 'partners',
      title: 'Partner logos',
      type: 'array',
      of: [defineArrayMember({type: 'imageWithAlt'})],
      validation: (rule) => rule.required().min(1),
    }),
    objectField('form', 'Form', [
      stringField('nameLabel', 'Name label'),
      stringField('namePlaceholder', 'Name placeholder'),
      stringField('emailLabel', 'Email label'),
      stringField('emailPlaceholder', 'Email placeholder'),
      stringField('messageLabel', 'Message label'),
      stringField('messagePlaceholder', 'Message placeholder'),
      stringField('submit', 'Submit button label'),
    ]),
  ],
})
```

- [ ] **Step 5: Documents**

`studio/schemaTypes/documents/home-page.ts`:
```ts
import {HomeIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

const section = (name: string, title: string, type: string) =>
  defineField({name, title, type, group: name, validation: (rule) => rule.required()})

export const homePage = defineType({
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  icon: HomeIcon,
  groups: [
    {name: 'hero', title: 'Hero'},
    {name: 'values', title: 'Values'},
    {name: 'products', title: 'Products'},
    {name: 'blog', title: 'Blog'},
    {name: 'contact', title: 'Contact'},
  ],
  initialValue: {language: 'en'},
  fields: [
    defineField({name: 'language', type: 'string', readOnly: true, hidden: true}),
    section('hero', 'Hero', 'heroSection'),
    section('values', 'Values', 'valuesSection'),
    section('products', 'Products', 'productsSection'),
    section('blog', 'Blog', 'blogSection'),
    section('contact', 'Contact', 'contactSection'),
  ],
  preview: {prepare: () => ({title: 'Home page', subtitle: 'English'})},
})
```
`studio/schemaTypes/documents/post.ts`:
```ts
import {DocumentTextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {imageField, stringField, urlField} from '../shared/fields'

export const post = defineType({
  name: 'post',
  title: 'Blog post',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    stringField('title', 'Title'),
    stringField('category', 'Category'),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description: 'Cards show the month and year only.',
      validation: (rule) => rule.required(),
    }),
    imageField('image', 'Card image'),
    urlField('url', 'Link (the blog post page)'),
  ],
  orderings: [{title: 'Newest first', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]}],
  preview: {select: {title: 'title', subtitle: 'date', media: 'image'}},
})
```
`studio/schemaTypes/documents/site-settings.ts`:
```ts
import {CogIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import {
  imageField,
  navItemField,
  objectField,
  stringField,
  textField,
  urlField,
} from '../shared/fields'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  icon: CogIcon,
  groups: [
    {name: 'meta', title: 'Meta & sharing'},
    {name: 'nav', title: 'Navigation'},
    {name: 'footer', title: 'Footer'},
    {name: 'links', title: 'Links'},
  ],
  initialValue: {language: 'en'},
  fields: [
    defineField({name: 'language', type: 'string', readOnly: true, hidden: true}),
    objectField(
      'meta',
      'Meta & sharing',
      [
        stringField('title', 'Page title'),
        textField('description', 'Description'),
        defineField({
          name: 'ogImage',
          title: 'Social sharing image',
          type: 'image',
          options: {hotspot: true},
          validation: (rule) => rule.required(),
        }),
      ],
      'meta',
    ),
    objectField(
      'nav',
      'Navigation',
      [
        stringField('logoAlt', 'Logo alt text'),
        stringField('openMenu', 'Open menu (screen reader label)'),
        stringField('closeMenu', 'Close menu (screen reader label)'),
        stringField('getStarted', 'Get started button'),
        objectField('organizations', 'For Organizations menu', [
          stringField('label', 'Menu label'),
          objectField('columns', 'Columns', [
            objectField('products', 'Products column', [
              stringField('label', 'Heading'),
              objectField('items', 'Items', [
                navItemField('messengerPigeon', 'Messenger Pigeon'),
                navItemField('podium', 'Podium Solution'),
                navItemField('liveServices', 'Live Services'),
              ]),
            ]),
            objectField('resources', 'Resources column', [
              stringField('label', 'Heading'),
              objectField('items', 'Items', [
                navItemField('blog', 'Blogs & Case Studies'),
                navItemField('help', 'Help Centre & FAQ'),
                navItemField('security', 'Data & Security Compliance'),
              ]),
            ]),
            objectField('start', 'Getting started column', [
              stringField('label', 'Heading'),
              objectField('items', 'Items', [
                navItemField('login', 'Login'),
                navItemField('bookCall', 'Book A Call'),
              ]),
            ]),
          ]),
          objectField('promo', 'Promo card', [
            stringField('label', 'Button label'),
            imageField('image', 'Image'),
          ]),
        ]),
        objectField('students', 'For Students menu', [
          stringField('label', 'Menu label'),
          stringField('columnLabel', 'Column heading'),
          objectField('items', 'Links', [
            stringField('messengerPigeon', 'Messenger Pigeon'),
            stringField('help', 'Help Center & FAQ'),
            stringField('download', 'Download The App'),
            stringField('helpAgain', 'Help Center & FAQ (second link)'),
            stringField('login', 'Login'),
          ]),
          objectField('promo', 'Promo card', [stringField('label', 'Button label')]),
        ]),
        stringField('about', 'About'),
        stringField('contact', 'Contact'),
        objectField('mobile', 'Mobile menu', [
          objectField('items', 'Items', [
            navItemField('messengerPigeon', 'Messenger Pigeon'),
            navItemField('liveServices', 'Live Services'),
            navItemField('about', 'About Us'),
            navItemField('blog', 'Blog & Insights'),
            navItemField('contact', 'Contact Us'),
            navItemField('login', 'Habitat Admin Login'),
          ]),
          objectField('promo', 'Promo card', [
            stringField('label', 'Button label'),
            imageField('image', 'Image'),
          ]),
        ]),
      ],
      'nav',
    ),
    objectField(
      'footer',
      'Footer',
      [
        stringField('logoAlt', 'Logo alt text'),
        objectField('columns', 'Columns', [
          objectField('login', 'Login column', [
            stringField('label', 'Heading'),
            objectField('items', 'Links', [
              stringField('messengerPigeon', 'Messenger Pigeon'),
              stringField('admin', 'Habitat Admin'),
            ]),
          ]),
          objectField('company', 'Company column', [
            stringField('label', 'Heading'),
            objectField('items', 'Links', [
              stringField('about', 'About Us'),
              stringField('careers', 'Careers'),
              stringField('security', 'Security'),
              stringField('download', 'Download'),
            ]),
          ]),
          objectField('resources', 'Resources column', [
            stringField('label', 'Heading'),
            objectField('items', 'Links', [
              stringField('help', 'Help Centre'),
              stringField('blog', 'Blog'),
              stringField('grants', 'Grants'),
              stringField('bookCall', 'Book a call'),
              stringField('partners', 'Partner Program'),
            ]),
          ]),
          objectField('more', 'More column', [
            stringField('label', 'Heading'),
            objectField('items', 'Links', [
              stringField('privacy', 'Privacy Policy'),
              stringField('securityAi', 'Security, Data & AI'),
              stringField('terms', 'Terms & Conditions'),
              stringField('accessibility', 'Accessibility'),
            ]),
          ]),
        ]),
        objectField('social', 'Social icons (screen reader labels)', [
          stringField('youtube', 'YouTube'),
          stringField('linkedin', 'LinkedIn'),
          stringField('instagram', 'Instagram'),
          stringField('tiktok', 'TikTok'),
        ]),
        stringField('copyright', 'Copyright'),
      ],
      'footer',
    ),
    objectField(
      'links',
      'Links (every URL used across the site, edit here once)',
      [
        urlField('home', 'Home (logo links)'),
        urlField('messengerPigeon', 'Messenger Pigeon'),
        urlField('podium', 'Podium Solution'),
        urlField('liveServices', 'Live Services'),
        urlField('blog', 'Blog'),
        urlField('help', 'Help Centre'),
        urlField('security', 'Data & security compliance'),
        urlField('adminLogin', 'Habitat Admin login'),
        urlField('apply', 'Get started / apply'),
        urlField('bookCall', 'Book a call'),
        urlField('messengerPigeonLogin', 'Messenger Pigeon login'),
        urlField('messengerPigeonDownload', 'Messenger Pigeon download'),
        urlField('whatsNewVideo', "What's new video"),
        urlField('about', 'About us'),
        urlField('careers', 'Careers'),
        urlField('contact', 'Contact us'),
        urlField('grants', 'Grants'),
        urlField('partners', 'Partner program'),
        urlField('privacy', 'Privacy policy'),
        urlField('securityAi', 'Security, data & AI'),
        urlField('terms', 'Terms & conditions'),
        urlField('accessibility', 'Accessibility'),
        urlField('youtube', 'YouTube'),
        urlField('linkedin', 'LinkedIn'),
        urlField('instagram', 'Instagram'),
        urlField('tiktok', 'TikTok'),
      ],
      'links',
    ),
  ],
  preview: {prepare: () => ({title: 'Site settings', subtitle: 'English'})},
})
```

- [ ] **Step 6: Register the types**

`studio/schemaTypes/index.ts`:
```ts
import {homePage} from './documents/home-page'
import {post} from './documents/post'
import {siteSettings} from './documents/site-settings'
import {blogSection} from './objects/blog-section'
import {contactSection} from './objects/contact-section'
import {heroSection} from './objects/hero-section'
import {imageWithAlt} from './objects/image-with-alt'
import {navItem} from './objects/nav-item'
import {productCard} from './objects/product-card'
import {productsSection} from './objects/products-section'
import {valuesSection} from './objects/values-section'

export const schemaTypes = [
  homePage,
  siteSettings,
  post,
  imageWithAlt,
  navItem,
  productCard,
  heroSection,
  valuesSection,
  productsSection,
  blogSection,
  contactSection,
]
```

- [ ] **Step 7: Structure, singletons, Presentation locations, config**

`studio/singletons.ts`:
```ts
// Document types that exist exactly once (fixed IDs: <type>-en, see the spec).
export const SINGLETONS = ['homePage', 'siteSettings']
```
`studio/structure.ts`:
```ts
import {CogIcon, HomeIcon} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Home page')
        .icon(HomeIcon)
        .child(S.document().schemaType('homePage').documentId('homePage-en').title('Home page')),
      S.listItem()
        .title('Site settings')
        .icon(CogIcon)
        .child(
          S.document().schemaType('siteSettings').documentId('siteSettings-en').title('Site settings'),
        ),
      S.divider(),
      S.documentTypeListItem('post').title('Blog posts'),
    ])
```
`studio/presentation/resolve.ts`:
```ts
import {defineLocations, type PresentationPluginOptions} from 'sanity/presentation'

const home = {title: 'Home page', href: '/'}

export const resolve: PresentationPluginOptions['resolve'] = {
  locations: {
    homePage: defineLocations({locations: [home]}),
    siteSettings: defineLocations({locations: [home]}),
    post: defineLocations({
      select: {title: 'title'},
      resolve: (doc) => ({locations: [{title: doc?.title || 'Untitled post', href: '/'}]}),
    }),
  },
}
```
`studio/sanity.config.ts` (replace the whole file):
```ts
import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {presentationTool} from 'sanity/presentation'
import {structureTool} from 'sanity/structure'
import {resolve} from './presentation/resolve'
import {schemaTypes} from './schemaTypes'
import {SINGLETONS} from './singletons'
import {structure} from './structure'

export default defineConfig({
  name: 'default',
  title: 'Habitat Learn',

  projectId: 'uruh3czl',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    presentationTool({
      resolve,
      previewUrl: {
        origin: process.env.SANITY_STUDIO_PREVIEW_ORIGIN || 'http://localhost:3000',
        previewMode: {enable: '/api/draft-mode/enable'},
      },
    }),
    visionTool(),
  ],

  schema: {types: schemaTypes},

  document: {
    // Singletons can be edited and published, but not deleted, unpublished or duplicated.
    actions: (prev, {schemaType}) =>
      SINGLETONS.includes(schemaType)
        ? prev.filter(
            ({action}) => action && !['unpublish', 'delete', 'duplicate'].includes(action),
          )
        : prev,
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global'
        ? prev.filter((item) => !SINGLETONS.includes(item.templateId))
        : prev,
  },
})
```
`studio/sanity.cli.ts` (add `typegen` to the existing config):
```ts
import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'uruh3czl',
    dataset: 'production',
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: '../{app,components,sanity}/**/*.{ts,tsx}',
    schema: './schema.json',
    generates: '../sanity.types.ts',
    overloadClientMethods: true,
  },
})
```

- [ ] **Step 8: Validate**

```bash
(cd studio && npx sanity schema validate && npx sanity build)
```
Expected: `Validation results: 0 errors, 0 warnings` and a successful build. Then `(cd studio && npm run dev)`, open http://localhost:3333: "Home page" and "Site settings" are pinned at the top, "Blog posts" below, and "New document" (top-left `+`) offers only Blog post. Stop the dev server.

- [ ] **Step 9: Commit**

```bash
npm run format && npm run lint && npm run build
git add studio package.json package-lock.json
git commit -m "feat(studio): add content schemas, structure, and Presentation config" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Seed script and round-trip verification

**Files:**
- Create: `studio/scripts/seed.ts`, `studio/scripts/verify-seed.ts`

**Interfaces:**
- Consumes: the schema field names from Task 5, `locales/en/{home,common}.json`, `lib/links.ts`, `lib/format-post-date.ts` (Task 4), images under `public/images/`.
- Produces: documents `homePage-en`, `siteSettings-en` and three `post` documents in dataset `production`. `npm run seed` is idempotent (singletons use `createOrReplace`; posts are matched on `url`; images dedupe by hash). `npm --prefix studio run verify-seed` exits 1 listing any JSON string that is missing from Sanity.

- [ ] **Step 1: Write `studio/scripts/seed.ts`**

```ts
// One-time import of locales/en/*.json, lib/links.ts and public/images into Sanity.
// Run from studio/:  npm run seed   (uses your `sanity login`; writes to the production dataset)
import {createReadStream, readFileSync} from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'
import {links} from '../../lib/links'

const client = getCliClient({apiVersion: '2026-09-01'})
const repoRoot = path.resolve(process.cwd(), '..')
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'))
const home = readJson('locales/en/home.json')
const common = readJson('locales/en/common.json')

const assetIds = new Map<string, string>()

async function image(
  publicPath: string,
  alt?: string,
  type: 'imageWithAlt' | 'image' = 'imageWithAlt',
) {
  let id = assetIds.get(publicPath)
  if (!id) {
    const asset = await client.assets.upload(
      'image',
      createReadStream(path.join(repoRoot, 'public', publicPath)),
      {filename: path.basename(publicPath)},
    )
    id = asset._id
    assetIds.set(publicPath, id)
  }
  return {
    _type: type,
    asset: {_type: 'reference', _ref: id},
    ...(alt === undefined ? {} : {alt}),
  }
}

async function keyedImage(key: string, publicPath: string, alt: string) {
  return {...(await image(publicPath, alt)), _key: key}
}

async function main() {
  // Order matches the components today.
  const avatarFiles: Array<[string, string]> = [
    ['csuci', '/images/logos/avatar-csuci.png'],
    ['berkeley', '/images/logos/avatar-berkeley.webp'],
    ['toronto', '/images/logos/avatar-toronto.png'],
    ['harvard', '/images/logos/avatar-harvard.webp'],
    ['ivyTech', '/images/logos/avatar-ivy-tech.webp'],
    ['humber', '/images/logos/avatar-humber.png'],
  ]
  const partnerFiles: Array<[string, string]> = [
    ['uoft', '/images/logos/uoft.png'],
    ['yale', '/images/logos/yale.png'],
    ['uws', '/images/logos/uws.png'],
    ['ivyTech', '/images/logos/ivy-tech.png'],
    ['csuci', '/images/logos/csuci.png'],
    ['humber', '/images/logos/humber.png'],
    ['harvard', '/images/logos/harvard.png'],
    ['berkeley', '/images/logos/uc-berkeley.png'],
    ['toronto', '/images/logos/city-of-toronto.png'],
  ]
  const valueKeys = ['accessibility', 'empathy', 'education', 'dataSovereignty']
  const productFiles: Record<string, string> = {
    messengerPigeon: '/images/products/messenger-pigeon.webp',
    podium: '/images/hero/grow.png',
    liveServices: '/images/products/live-services.webp',
  }

  const homePage = {
    _id: 'homePage-en',
    _type: 'homePage',
    language: 'en',
    hero: {
      label: home.hero.label,
      title: home.hero.title,
      description: home.hero.description,
      primaryCta: home.hero.primaryCta,
      secondaryCta: home.hero.secondaryCta,
      trustedBy: home.hero.trustedBy,
      pauseVideo: home.hero.pauseVideo,
      playVideo: home.hero.playVideo,
      avatars: await Promise.all(
        avatarFiles.map(([key, file]) => keyedImage(key, file, home.hero.avatars[key])),
      ),
      teamImage: await image('/images/hero/team-study-session.webp', home.hero.teamImageAlt),
      followUp: home.hero.followUp,
    },
    values: {
      label: home.values.label,
      title: home.values.title,
      image: await image('/images/values/study-kit.webp', home.values.imageAlt),
      items: valueKeys.map((key) => ({_key: key, ...home.values.items[key]})),
    },
    products: {
      label: home.products.label,
      title: home.products.title,
      description: home.products.description,
      learnMore: home.products.learnMore,
      items: Object.fromEntries(
        await Promise.all(
          Object.entries(productFiles).map(async ([key, file]) => {
            const item = home.products.items[key]
            return [
              key,
              {
                title: item.title,
                description: item.description,
                image: await image(file, item.imageAlt),
              },
            ]
          }),
        ),
      ),
    },
    blog: {label: home.blog.label, title: home.blog.title, nextPage: home.blog.nextPage},
    contact: {
      title: home.contact.title,
      description: home.contact.description,
      partnersLabel: home.contact.partnersLabel,
      partners: await Promise.all(
        partnerFiles.map(([key, file]) => keyedImage(key, file, home.contact.partners[key])),
      ),
      form: home.contact.form,
    },
  }

  const {nav, footer, meta} = common
  const {blogPosts, ...flatLinks} = links
  const siteSettings = {
    _id: 'siteSettings-en',
    _type: 'siteSettings',
    language: 'en',
    meta: {
      title: meta.title,
      description: meta.description,
      ogImage: await image('/images/og-image.jpg', undefined, 'image'),
    },
    nav: {
      logoAlt: nav.logoAlt,
      openMenu: nav.openMenu,
      closeMenu: nav.closeMenu,
      getStarted: nav.getStarted,
      organizations: {
        label: nav.organizations.label,
        columns: nav.organizations.columns,
        promo: {
          label: nav.organizations.promo.label,
          image: await image('/images/nav/group-study-session.webp', nav.organizations.promo.imageAlt),
        },
      },
      students: nav.students,
      about: nav.about,
      contact: nav.contact,
      mobile: {
        items: nav.mobile.items,
        promo: {
          label: nav.mobile.promo.label,
          image: await image('/images/nav/mac-mini-privacy.webp', nav.mobile.promo.imageAlt),
        },
      },
    },
    footer,
    links: flatLinks,
  }

  await client.createOrReplace(homePage)
  await client.createOrReplace(siteSettings)
  console.log('wrote homePage-en and siteSettings-en')

  const posts = [
    {key: 'messengerPigeonV2', date: '2026-08-01', file: '/images/blog/messenger-pigeon-v2.jpg'},
    {key: 'ottawa', date: '2026-06-01', file: '/images/blog/university-of-ottawa.jpg'},
    {key: 'wcag', date: '2026-05-01', file: '/images/blog/wcag-compliance.jpg'},
  ] as const

  for (const {key, date, file} of posts) {
    const copy = home.blog.posts[key]
    const url = blogPosts[key]
    const doc = {
      _type: 'post',
      title: copy.title,
      category: copy.category,
      date,
      image: await image(file, copy.imageAlt),
      url,
    }
    // Post IDs are generated by Sanity; match an existing post on its url so re-runs don't duplicate.
    const existingId = await client.fetch<string | null>(
      `*[_type == "post" && url == $url][0]._id`,
      {url},
    )
    if (existingId) await client.createOrReplace({_id: existingId, ...doc})
    else await client.create(doc)
    console.log(`wrote post: ${copy.title}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 2: Write `studio/scripts/verify-seed.ts`**

```ts
// Confirms every string from locales/en/*.json and lib/links.ts exists in Sanity, and that every
// image field has an asset. Run from studio/:  npm run verify-seed
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'
import {formatPostDate} from '../../lib/format-post-date'
import {links} from '../../lib/links'

const client = getCliClient({apiVersion: '2026-09-01'})
const repoRoot = path.resolve(process.cwd(), '..')
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'))

function leaves(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') out.add(value)
  else if (Array.isArray(value)) value.forEach((item) => leaves(item, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => leaves(item, out))
  return out
}

function imagesWithoutAsset(value: unknown, trail = '', out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item, i) => imagesWithoutAsset(item, `${trail}[${i}]`, out))
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ((record._type === 'imageWithAlt' || record._type === 'image') && !record.asset) out.push(trail)
    Object.entries(record).forEach(([key, item]) => imagesWithoutAsset(item, `${trail}.${key}`, out))
  }
  return out
}

async function main() {
  const docs: Array<Record<string, unknown>> = await client.fetch(
    `*[_id in ["homePage-en", "siteSettings-en"] || _type == "post"]`,
  )
  const actual = leaves(docs)
  // Cards show a formatted date, so compare the formatted form of each post date.
  docs
    .filter((doc) => doc._type === 'post')
    .forEach((doc) => actual.add(formatPostDate(String(doc.date))))

  const expected = new Set<string>()
  leaves(readJson('locales/en/home.json'), expected)
  leaves(readJson('locales/en/common.json'), expected)
  leaves(links, expected)

  const missing = [...expected].filter((text) => !actual.has(text))
  const noAsset = imagesWithoutAsset(docs)
  const posts = docs.filter((doc) => doc._type === 'post').length

  console.log(`expected ${expected.size} strings, missing ${missing.length}; posts: ${posts}`)
  missing.forEach((text) => console.log(`  MISSING: ${text}`))
  noAsset.forEach((where) => console.log(`  IMAGE WITHOUT ASSET: ${where}`))

  if (missing.length || noAsset.length || posts < 3 || docs.length < 5) process.exit(1)
  console.log('OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 3: [USER-CONFIRM] Run the seed, then verify**

This writes to the live `production` dataset of Sanity project `uruh3czl` and uploads about 30 images. With the user's yes:
```bash
(cd studio && npm run seed)
(cd studio && npm run verify-seed)
```
Expected: seed prints `wrote homePage-en and siteSettings-en` and three `wrote post: …` lines; verify prints `missing 0`, `posts: 3` and `OK`. If strings are missing, fix `seed.ts` (a field name that differs from the schema is the usual cause) and re-run: the seed is idempotent.

- [ ] **Step 4: Confirm the Studio shows the data**

`(cd studio && npm run dev)`: open Home page and Site settings; every field has a value and no validation errors (red/yellow markers) appear; Blog posts lists three posts. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add studio/scripts studio/package.json
git commit -m "feat(studio): add seed and round-trip verification scripts" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Site data layer (queries, fetch helpers, image component, TypeGen)

**Files:**
- Create: `sanity/queries.ts`, `sanity/lib/fetch.ts`, `sanity/lib/site.ts`, `components/ui/SanityImage.tsx`, `sanity.types.ts` (generated)

**Interfaces:**
- Consumes: `sanityFetch` (Task 3), `assertFound` (Task 4), schema names (Task 5).
- Produces:
  - queries: `SITE_SETTINGS_QUERY`, `SITE_META_QUERY`, `SITE_LINKS_QUERY`, `HOME_HERO_QUERY`, `HOME_VALUES_QUERY`, `HOME_PRODUCTS_QUERY`, `HOME_BLOG_QUERY`, `HOME_POSTS_QUERY`, `HOME_CONTACT_QUERY`
  - `fetchRequired(query)`: fetches and throws (via `assertFound`) if the result is null
  - `getSiteSettings()`: cached per request
  - `getLinks()`: stega-cleaned `siteSettings.links`
  - `<SanityImage image={...} alt? {...next/image props except src}>`, which renders nothing when the image has no asset; `alt` defaults to `image.alt`; pass `alt=""` to force decorative

- [ ] **Step 1: Queries** `sanity/queries.ts`

```ts
import { defineQuery } from "next-sanity";

// Query names must be unique across the codebase (TypeGen keys types by name).
export const SITE_SETTINGS_QUERY = defineQuery(`*[_id == "siteSettings-en"][0]`);
export const SITE_META_QUERY = defineQuery(`*[_id == "siteSettings-en"][0].meta`);
export const SITE_LINKS_QUERY = defineQuery(`*[_id == "siteSettings-en"][0].links`);

export const HOME_HERO_QUERY = defineQuery(`*[_id == "homePage-en"][0].hero`);
export const HOME_VALUES_QUERY = defineQuery(`*[_id == "homePage-en"][0].values`);
export const HOME_PRODUCTS_QUERY = defineQuery(`*[_id == "homePage-en"][0].products`);
export const HOME_BLOG_QUERY = defineQuery(`*[_id == "homePage-en"][0].blog`);
export const HOME_CONTACT_QUERY = defineQuery(`*[_id == "homePage-en"][0].contact`);

export const HOME_POSTS_QUERY = defineQuery(`*[_type == "post"] | order(date desc)[0...3]`);
```

- [ ] **Step 2: Fetch helpers**

`sanity/lib/fetch.ts`:
```ts
import { assertFound } from "./assert-found";
import { sanityFetch } from "./live";

// Fetch a singleton section; fail loudly (with a seed hint) if the dataset is missing it.
export async function fetchRequired<const Query extends string>(query: Query) {
  const { data } = await sanityFetch({ query });
  return assertFound(data, query);
}
```
`sanity/lib/site.ts`:
```ts
import { cache } from "react";
import { stegaClean } from "next-sanity";
import { SITE_LINKS_QUERY, SITE_SETTINGS_QUERY } from "@/sanity/queries";
import { fetchRequired } from "./fetch";

export const getSiteSettings = cache(() => fetchRequired(SITE_SETTINGS_QUERY));

// URLs are never rendered as visible text, so strip stega before using them as hrefs.
export const getLinks = cache(async () => stegaClean(await fetchRequired(SITE_LINKS_QUERY)));
```

- [ ] **Step 3: `SanityImage`** `components/ui/SanityImage.tsx`

```tsx
import Image, { type ImageProps } from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "@/sanity/lib/image";

// Structural subset of an `imageWithAlt` value as returned by GROQ.
export type SanityImageValue = {
  asset?: { _ref: string } | null;
  crop?: object | null;
  hotspot?: object | null;
  alt?: string | null;
};

type SanityImageProps = Omit<ImageProps, "src" | "alt"> & {
  image: SanityImageValue;
  /** Overrides the editor's alt text; pass "" for a decorative repeat of another image. */
  alt?: string;
};

// next/image for a Sanity image. The editor's crop is applied by urlFor; resizing is left to
// next/image. Renders nothing if the editor removed the asset, so the page never crashes.
export default function SanityImage({ image, alt, ...props }: SanityImageProps) {
  if (!image.asset) return null;

  return (
    <Image
      src={urlFor(image as SanityImageSource).url()}
      alt={alt ?? image.alt ?? ""}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Generate types and type-check**

```bash
npm run typegen
npx tsc --noEmit
```
Expected: `sanity.types.ts` is created at the repo root with `HOME_HERO_QUERY_RESULT` and the other result types; `tsc` passes. If `tsc` rejects `assertFound(data, query)` or the `SanityImage` cast because of the generic return type, adjust `fetchRequired`'s return type to `Promise<NonNullable<typeof data>>` (do not use `any`).

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint && npm run build
git add sanity components/ui/SanityImage.tsx sanity.types.ts
git commit -m "feat: add Sanity queries, fetch helpers, and SanityImage" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Site chrome from Sanity (metadata, Nav, Footer)

**Files:**
- Modify: `app/layout.tsx` (`generateMetadata`), `components/layout/Nav.tsx`, `components/layout/Footer.tsx`

**Interfaces:**
- Consumes: `getSiteSettings()` (`{ meta, nav, footer, links }` typed by TypeGen), `SanityImage`, `sanityFetch`, `SITE_META_QUERY`, `urlFor`.

- [ ] **Step 1: Metadata in `app/layout.tsx`**

Replace the `getTranslations` import usage: change `import { getLocale, getTranslations } from "next-intl/server";` to `import { getLocale } from "next-intl/server";`, add these imports:
```tsx
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";
import { SITE_META_QUERY } from "@/sanity/queries";
```
and replace `generateMetadata`:
```tsx
export async function generateMetadata(): Promise<Metadata> {
  // stega must be off here: invisible characters must never reach <head>.
  const { data: meta } = await sanityFetch({ query: SITE_META_QUERY, stega: false });
  if (!meta) throw new Error('No siteSettings meta found. Run "npm run seed" in studio/.');
  // Generated image types mark `asset` optional, so cast like SanityImage does.
  const ogImage = meta.ogImage ? [urlFor(meta.ogImage as SanityImageSource).url()] : undefined;

  return {
    // Vercel exposes the production domain; fall back to localhost in dev.
    metadataBase: new URL(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000",
    ),
    title: meta.title,
    description: meta.description,
    openGraph: {
      type: "website",
      title: meta.title,
      description: meta.description,
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ogImage,
    },
  };
}
```

- [ ] **Step 2: Rewrite `components/layout/Nav.tsx`** (same markup and classes; only the data source changes)

```tsx
import Image from "next/image";
import { stegaClean } from "next-sanity";
import Button from "@/components/ui/Button";
import SanityImage from "@/components/ui/SanityImage";
import SectionLabel from "@/components/ui/SectionLabel";
import PromoTile from "./PromoTile";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { getSiteSettings } from "@/sanity/lib/site";

const navLink =
  "block rounded-button border border-transparent px-3 py-2.5 text-[16px] font-medium leading-4 text-brand-purple transition-colors hover:border-paper/8 hover:bg-brand-purple hover:text-paper";

// Full-width panel that drops below the nav bar while its `group/dd` parent is hovered or focused.
const dropdownPanel =
  "invisible fixed inset-x-0 top-[70px] z-10 pt-5 opacity-0 transition-opacity duration-200 group-hover/dd:visible group-hover/dd:opacity-100 group-focus-within/dd:visible group-focus-within/dd:opacity-100";

export default async function Nav() {
  const settings = await getSiteSettings();
  const { nav } = settings;
  const links = stegaClean(settings.links);
  const { products, resources, start } = nav.organizations.columns;

  // Which link each menu entry points to stays in code; labels and URLs come from Sanity.
  const orgColumns = [
    {
      key: "products",
      label: products.label,
      items: [
        { key: "messengerPigeon", ...products.items.messengerPigeon, href: links.messengerPigeon },
        { key: "podium", ...products.items.podium, href: links.podium },
        { key: "liveServices", ...products.items.liveServices, href: links.liveServices },
      ],
    },
    {
      key: "resources",
      label: resources.label,
      items: [
        { key: "blog", ...resources.items.blog, href: links.blog },
        { key: "help", ...resources.items.help, href: links.help },
        { key: "security", ...resources.items.security, href: links.security },
      ],
    },
    {
      key: "start",
      label: start.label,
      items: [
        { key: "login", ...start.items.login, href: links.adminLogin },
        { key: "bookCall", ...start.items.bookCall, href: links.bookCall },
      ],
    },
  ];

  const studentItems = [
    { key: "messengerPigeon", label: nav.students.items.messengerPigeon, href: links.messengerPigeon },
    { key: "help", label: nav.students.items.help, href: links.help },
    { key: "download", label: nav.students.items.download, href: links.messengerPigeonDownload },
    { key: "helpAgain", label: nav.students.items.helpAgain, href: links.help },
    { key: "login", label: nav.students.items.login, href: links.messengerPigeonLogin },
  ];

  const mobileItems = [
    { key: "messengerPigeon", ...nav.mobile.items.messengerPigeon, href: links.messengerPigeon },
    { key: "liveServices", ...nav.mobile.items.liveServices, href: links.liveServices },
    { key: "about", ...nav.mobile.items.about, href: links.about },
    { key: "blog", ...nav.mobile.items.blog, href: links.blog },
    { key: "contact", ...nav.mobile.items.contact, href: links.contact },
    { key: "login", ...nav.mobile.items.login, href: links.adminLogin },
  ];

  return (
    <header className="group/nav relative z-[999]">
      <div className="relative z-[3] bg-canvas py-4 transition-colors has-[.dd:hover]:bg-paper md:py-5">
        {/* Mobile menu toggle. Checked state is read with group-has-[...]. */}
        <input
          id="nav-toggle"
          type="checkbox"
          aria-label={nav.openMenu}
          className="peer sr-only"
        />

        <div className="relative z-[2] mx-auto flex max-w-page items-center justify-between px-8">
          <a href={links.home} className="block">
            <Image
              src="/images/logos/habitat-learn-logo-colour.png"
              alt={nav.logoAlt}
              width={573}
              height={264}
              priority
              className="h-auto w-[119px] md:w-[136px]"
            />
          </a>

          {/* Mobile / tablet menu button */}
          <label
            htmlFor="nav-toggle"
            className="relative flex h-7 w-8 cursor-pointer items-center justify-center rounded-pill border border-brand-purple/16 text-brand-purple shadow-button backdrop-blur-[10px] peer-focus-visible:outline lg:hidden"
          >
            <span className="sr-only">{nav.openMenu}</span>
            <MenuIcon className="h-3 w-3 group-has-[#nav-toggle:checked]/nav:hidden" />
            <CloseIcon className="hidden h-4 w-4 group-has-[#nav-toggle:checked]/nav:block" />
          </label>

          {/* Desktop links */}
          <nav className="hidden items-center lg:flex">
            <div className="dd group/dd">
              <div
                tabIndex={0}
                className={`cursor-pointer ${navLink} group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper`}
              >
                {nav.organizations.label}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto grid max-w-page grid-cols-4 gap-4 px-8">
                    <div className="col-span-3 grid grid-cols-3 gap-4">
                      {orgColumns.map((column) => (
                        <div key={column.key} className="flex flex-col items-start gap-8">
                          <SectionLabel className="ml-[5px]">{column.label}</SectionLabel>
                          <div className="flex flex-col items-start gap-4">
                            {column.items.map((item) => (
                              <a
                                key={item.key}
                                href={item.href}
                                className="flex max-w-full flex-col items-start text-brand-purple/88"
                              >
                                <div>{item.label}</div>
                                <div className="text-body-sm text-brand-purple/64">
                                  {item.description}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <PromoTile
                      className="h-[332px]"
                      media={
                        <SanityImage
                          image={nav.organizations.promo.image}
                          fill
                          sizes="332px"
                          className="object-cover"
                        />
                      }
                    >
                      <Button href={links.blog}>{nav.organizations.promo.label}</Button>
                    </PromoTile>
                  </div>
                </div>
              </div>
            </div>

            <div className="dd group/dd">
              <div
                tabIndex={0}
                className={`cursor-pointer ${navLink} group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper`}
              >
                {nav.students.label}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto flex max-w-page justify-between gap-6 px-8">
                    <div className="flex flex-col items-start gap-8">
                      <SectionLabel className="ml-[5px]">{nav.students.columnLabel}</SectionLabel>
                      <div className="flex flex-col items-start">
                        {studentItems.map((item) => (
                          <a key={item.key} href={item.href} className="text-brand-purple/88">
                            {item.label}
                          </a>
                        ))}
                      </div>
                    </div>
                    <PromoTile
                      className="h-[332px] w-[448px]"
                      gradient="h-2/5"
                      media={
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          poster="/images/nav/mp-clip-poster.jpg"
                          className="absolute inset-0 h-full w-full object-cover"
                        >
                          <source src="/video/messenger-pigeon-clip.webm" type="video/webm" />
                        </video>
                      }
                    >
                      <Button href={links.whatsNewVideo}>{nav.students.promo.label}</Button>
                    </PromoTile>
                  </div>
                </div>
              </div>
            </div>

            <a href={links.about} className={navLink}>
              {nav.about}
            </a>
            <a href={links.contact} className={navLink}>
              {nav.contact}
            </a>
          </nav>

          <Button href={links.apply} className="hidden lg:flex">
            {nav.getStarted}
          </Button>
        </div>

        {/* Mobile / tablet menu panel */}
        <div className="absolute inset-x-0 top-full z-[3] hidden bg-paper px-4 py-3 group-has-[#nav-toggle:checked]/nav:flex lg:!hidden">
          <div className="flex w-full flex-col gap-12">
            <div className="flex flex-col gap-3">
              {mobileItems.map((item) => (
                <div key={item.key} className="flex flex-col gap-3">
                  <div className="h-px w-full bg-brand-purple/16" />
                  <a href={item.href} className="flex flex-col items-start text-brand-purple">
                    <span className="text-body-lg">{item.label}</span>
                    <span className="text-body-sm text-brand-purple/50">{item.description}</span>
                  </a>
                </div>
              ))}
            </div>
            <PromoTile
              className="h-[245px]"
              media={
                <SanityImage
                  image={nav.mobile.promo.image}
                  fill
                  sizes="358px"
                  className="object-cover"
                />
              }
            >
              <Button href={links.blog}>{nav.mobile.promo.label}</Button>
            </PromoTile>
          </div>
        </div>
      </div>

      {/* Dims the page behind the open mobile menu. */}
      <div className="pointer-events-none fixed inset-0 z-[2] hidden bg-brand-purple/25 group-has-[#nav-toggle:checked]/nav:block lg:!hidden" />
    </header>
  );
}
```

- [ ] **Step 3: Rewrite `components/layout/Footer.tsx`**

```tsx
import Image from "next/image";
import { stegaClean } from "next-sanity";
import Label from "@/components/ui/Label";
import { getSiteSettings } from "@/sanity/lib/site";

export default async function Footer() {
  const settings = await getSiteSettings();
  const { footer } = settings;
  const links = stegaClean(settings.links);
  const { login, company, resources, more } = footer.columns;

  // Which link each entry points to stays in code; labels and URLs come from Sanity.
  const columns = [
    {
      key: "login",
      label: login.label,
      items: [
        { key: "messengerPigeon", label: login.items.messengerPigeon, href: links.messengerPigeonLogin },
        { key: "admin", label: login.items.admin, href: links.adminLogin },
      ],
    },
    {
      key: "company",
      label: company.label,
      items: [
        { key: "about", label: company.items.about, href: links.about },
        { key: "careers", label: company.items.careers, href: links.careers },
        { key: "security", label: company.items.security, href: links.security },
        { key: "download", label: company.items.download, href: links.messengerPigeonDownload },
      ],
    },
    {
      key: "resources",
      label: resources.label,
      items: [
        { key: "help", label: resources.items.help, href: links.help },
        { key: "blog", label: resources.items.blog, href: links.blog },
        { key: "grants", label: resources.items.grants, href: links.grants },
        { key: "bookCall", label: resources.items.bookCall, href: links.contact },
        { key: "partners", label: resources.items.partners, href: links.partners },
      ],
    },
    {
      key: "more",
      label: more.label,
      items: [
        { key: "privacy", label: more.items.privacy, href: links.privacy },
        { key: "securityAi", label: more.items.securityAi, href: links.securityAi },
        { key: "terms", label: more.items.terms, href: links.terms },
        { key: "accessibility", label: more.items.accessibility, href: links.accessibility },
      ],
    },
  ];

  const social = [
    { key: "youtube", label: footer.social.youtube, href: links.youtube },
    { key: "linkedin", label: footer.social.linkedin, href: links.linkedin },
    { key: "instagram", label: footer.social.instagram, href: links.instagram },
    { key: "tiktok", label: footer.social.tiktok, href: links.tiktok },
  ];

  return (
    <footer className="relative z-[1] bg-brand-green pb-4 pt-12 text-paper/88 md:pb-8 md:pt-20">
      <div className="mx-auto flex max-w-page flex-col gap-10 px-page pb-10 md:gap-content">
        <div className="grid grid-cols-1 gap-12 md:gap-16 lg:grid-cols-2">
          <a href={links.home} className="block w-[136px] md:w-[170px]">
            <Image
              src="/images/logos/habitat-learn-logo-white.png"
              alt={footer.logoAlt}
              width={1975}
              height={907}
              className="h-auto w-full"
            />
          </a>

          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-4">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-4 md:gap-5">
                <Label size="sm" className="text-paper/64">
                  {column.label}
                </Label>
                <div className="flex flex-col">
                  {column.items.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="transition-opacity hover:opacity-70"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-paper/16 pb-6 pt-8 md:gap-8 md:pb-8 md:pt-12">
          <div className="flex items-center gap-3 md:gap-4">
            {social.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="block h-3 w-3 transition-opacity hover:opacity-50 md:h-4 md:w-4"
              >
                <Image
                  src={`/images/icons/${item.key}.svg`}
                  alt={item.label}
                  width={16}
                  height={16}
                  className="h-full w-full"
                  unoptimized
                />
              </a>
            ))}
          </div>
          <Label size="sm" className="text-paper/64">
            {footer.copyright}
          </Label>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Build, then compare against the baseline**

```bash
npm run format && npm run lint && npm run build
npx next start -p 3100 &
sleep 4
node scripts/visual/check.mjs capture after-chrome
node scripts/visual/check.mjs compare baseline after-chrome
kill %1
```
Expected: `PASS`. If it fails, open `.visual/after-chrome/diff-<width>.png`. Hover the desktop dropdowns and open the mobile menu by hand at 390px to confirm they work (the screenshots don't cover them); check page title/description in the tab.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx components/layout
git commit -m "feat: read nav, footer, and metadata from Sanity" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Hero from Sanity

**Files:** Modify `components/home/Hero.tsx`.

**Interfaces:** Consumes `fetchRequired(HOME_HERO_QUERY)`, `getLinks()`, `SanityImage`. `hero.avatars[]` items carry `_key`, `asset`, `alt`.

- [ ] **Step 1: Replace `components/home/Hero.tsx`** (same markup and classes; `grow.png` stays a local decorative image, the video stays local)

```tsx
import Image from "next/image";
import BackgroundVideo from "@/components/ui/BackgroundVideo";
import Button from "@/components/ui/Button";
import Label from "@/components/ui/Label";
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionLabel from "@/components/ui/SectionLabel";
import { CheckCircleIcon, MailIcon } from "@/components/ui/Icons";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_HERO_QUERY } from "@/sanity/queries";

export default async function Hero() {
  const [hero, links] = await Promise.all([fetchRequired(HOME_HERO_QUERY), getLinks()]);

  return (
    <Section top="lg">
      {/* Headline */}
      <div className="mx-auto mb-8 flex max-w-headline flex-col items-center gap-4 text-center text-brand-purple md:mb-12 md:gap-6">
        <SectionLabel className="ml-[5px]">{hero.label}</SectionLabel>
        <h1 className="font-heading text-h1">{hero.title}</h1>
        <p className="mb-2.5 max-w-[450px] text-brand-purple/64">{hero.description}</p>
        <div className="flex items-center justify-center gap-2.5">
          <Button href={links.contact} withArrow>
            {hero.primaryCta}
          </Button>
          <Button href={links.contact} variant="secondary" className="hidden md:flex">
            {hero.secondaryCta}
          </Button>
        </div>
      </div>

      {/* Social proof */}
      <div className="mb-12 flex flex-col items-center gap-3 md:mb-16 md:gap-4">
        <div className="flex">
          {hero.avatars.map((avatar, index) => (
            <div
              key={avatar._key}
              className={`relative h-10 w-10 flex-none overflow-hidden rounded-full border-2 border-paper md:h-12 md:w-12 ${index > 0 ? "-ml-4" : ""}`}
            >
              <SanityImage
                image={avatar}
                fill
                sizes="(min-width: 768px) 48px, 40px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <div className="text-body-sm text-brand-purple/64">{hero.trustedBy}</div>
      </div>

      {/* Media grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_10fr] md:gap-4">
        <div className="relative h-[360px] overflow-hidden rounded-card md:h-full">
          <BackgroundVideo
            src="/video/hero.webm"
            poster="/images/hero/hero-video-poster.jpg"
            pauseLabel={hero.pauseVideo}
            playLabel={hero.playVideo}
          />
        </div>

        <div className="grid grid-cols-1 grid-rows-[165px_165px] gap-3 md:h-[570px] md:grid-cols-2 md:grid-rows-2 md:gap-4 lg:h-auto lg:grid-cols-[1.25fr_1fr]">
          <div className="relative overflow-hidden rounded-card md:col-span-2 lg:col-span-1">
            <SanityImage
              image={hero.teamImage}
              quality={90}
              fill
              sizes="(min-width: 992px) 436px, (min-width: 768px) 435px, 358px"
              className="object-cover"
            />
          </div>

          <div className="hidden aspect-square items-center justify-center overflow-hidden rounded-card bg-lift p-6 text-brand-purple lg:flex">
            <Image
              src="/images/hero/grow.png"
              alt=""
              width={300}
              height={300}
              className="block h-auto max-w-full"
            />
          </div>

          <div className="flex items-center justify-center rounded-card bg-brand-purple p-6 text-paper/88 md:col-span-2 md:p-16">
            <div className="flex w-full max-w-widget flex-col gap-2.5">
              <div className="flex flex-col gap-3 rounded-card border border-brand-purple/16 bg-paper p-3 text-brand-purple/88 md:gap-4 md:p-4">
                <div className="flex items-center gap-4">
                  <MailIcon className="h-3 w-3 flex-none text-brand-purple/64 md:h-4 md:w-4" />
                  <Label>{hero.followUp.title}</Label>
                </div>
                <div className="h-px w-full bg-brand-purple/16" />
                <div className="text-body-sm text-brand-purple">{hero.followUp.message}</div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircleIcon className="h-3 w-3 flex-none text-paper/64 md:h-4 md:w-4" />
                  <Label size="sm" className="text-paper/64">
                    {hero.followUp.sentBy}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run format && npm run lint && npm run build
npx next start -p 3100 &
sleep 4
node scripts/visual/check.mjs capture after-hero
node scripts/visual/check.mjs compare baseline after-hero
kill %1
```
Expected: `PASS`. Also confirm the video plays and the pause button toggles it.

- [ ] **Step 3: Commit**

```bash
git add components/home/Hero.tsx
git commit -m "feat: read the hero from Sanity" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Values and Products from Sanity

**Files:** Modify `components/home/Values.tsx`, `components/home/Products.tsx`.

**Interfaces:** Consumes `HOME_VALUES_QUERY` (`{ label, title, image, items[{_key,title,description}] }`), `HOME_PRODUCTS_QUERY` (`{ label, title, description, learnMore, items: { messengerPigeon, podium, liveServices } }` each `{ title, description, image }`), `getLinks()`.

- [ ] **Step 1: Replace `components/home/Values.tsx`**

```tsx
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { fetchRequired } from "@/sanity/lib/fetch";
import { HOME_VALUES_QUERY } from "@/sanity/queries";

export default async function Values() {
  const values = await fetchRequired(HOME_VALUES_QUERY);

  return (
    <Section top="sm" bottom="md">
      <SectionHeader
        label={values.label}
        title={values.title}
        size="h4"
        spacing="tight"
        className="animate-on-scroll mb-14 md:mb-20"
      />

      <div className="grid grid-cols-1 gap-8 md:gap-12 lg:grid-cols-2 lg:gap-[132px]">
        <div className="animate-on-scroll relative h-[362px] overflow-hidden rounded-card border border-brand-purple/16 lg:h-auto">
          <SanityImage
            image={values.image}
            quality={90}
            fill
            sizes="(min-width: 992px) 622px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="border-t border-brand-purple/16">
          {values.items.map((item) => (
            <div
              key={item._key}
              className="animate-on-scroll grid grid-cols-1 gap-3 border-b border-brand-purple/16 py-4 md:grid-cols-2 md:gap-4 md:py-6"
            >
              <div className="font-medium text-brand-purple">{item.title}</div>
              <div className="text-brand-purple">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Replace `components/home/Products.tsx`**

```tsx
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowIcon } from "@/components/ui/Icons";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_PRODUCTS_QUERY } from "@/sanity/queries";

export default async function Products() {
  const [products, links] = await Promise.all([fetchRequired(HOME_PRODUCTS_QUERY), getLinks()]);

  // On tablet and desktop each card sticks while scrolling and is offset from
  // the previous one (`offset`), giving the staggered "stacking" effect.
  const cards = [
    { key: "messengerPigeon", href: links.messengerPigeon, offset: "" },
    { key: "podium", href: links.podium, offset: "md:mt-16" },
    { key: "liveServices", href: links.liveServices, offset: "md:mt-[120px]" },
  ] as const;

  return (
    <Section top="md" bottom="md">
      <SectionHeader
        label={products.label}
        title={products.title}
        description={products.description}
        align="center"
        className="animate-on-scroll mb-14 md:mb-20"
      />

      <div className="mx-auto grid max-w-products grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {cards.map(({ key, href, offset }) => {
          const card = products.items[key];
          return (
            <div key={key} className="relative">
              <div
                className={`flex min-h-[330px] flex-col items-start justify-between rounded-panel bg-lift p-6 md:sticky md:top-[360px] md:min-h-[443px] md:p-8 ${offset}`}
              >
                <h3 className="text-body-lg font-medium text-brand-purple">{card.title}</h3>
                <SanityImage
                  image={card.image}
                  width={118}
                  height={118}
                  className="mx-auto h-[90px] w-[90px] md:h-[118px] md:w-[118px]"
                />
                <div className="text-brand-purple">{card.description}</div>
                <a
                  href={href}
                  className="relative flex items-center gap-2.5 text-button font-medium text-brand-purple transition-colors hover:text-brand-purple/88"
                >
                  <ArrowIcon className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{products.learnMore}</span>
                  <span className="absolute inset-x-0 bottom-0 h-px bg-brand-purple" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run format && npm run lint && npm run build
npx next start -p 3100 &
sleep 4
node scripts/visual/check.mjs capture after-products
node scripts/visual/check.mjs compare baseline after-products
kill %1
```
Expected: `PASS` (the Podium card's `grow.png` renders from Sanity and looks identical).

- [ ] **Step 4: Commit**

```bash
git add components/home/Values.tsx components/home/Products.tsx
git commit -m "feat: read values and products from Sanity" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Blog and Contact from Sanity

**Files:** Modify `components/home/Blog.tsx`, `components/home/Contact.tsx`.

**Interfaces:** Consumes `HOME_BLOG_QUERY` (`{ label, title, nextPage }`), `HOME_POSTS_QUERY` (posts with `_id, title, category, date, image, url`), `HOME_CONTACT_QUERY`, `formatPostDate`, `getLinks()`.

- [ ] **Step 1: Replace `components/home/Blog.tsx`**

```tsx
import { stegaClean } from "next-sanity";
import Label from "@/components/ui/Label";
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowLargeIcon } from "@/components/ui/Icons";
import { formatPostDate } from "@/lib/format-post-date";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_BLOG_QUERY, HOME_POSTS_QUERY } from "@/sanity/queries";

export default async function Blog() {
  const [blog, posts, links] = await Promise.all([
    fetchRequired(HOME_BLOG_QUERY),
    fetchRequired(HOME_POSTS_QUERY),
    getLinks(),
  ]);

  return (
    <Section top="md">
      <SectionHeader
        label={blog.label}
        title={blog.title}
        size="h3"
        className="animate-on-scroll mb-12 md:mb-16"
      />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-x-4 md:gap-y-8">
        {posts.map((post) => (
          <a
            key={post._id}
            href={stegaClean(post.url)}
            className="animate-on-scroll flex flex-col gap-3 text-brand-purple md:gap-4"
          >
            <div className="relative h-[300px] overflow-hidden rounded-card md:h-[340px]">
              <SanityImage
                image={post.image}
                quality={90}
                fill
                sizes="(min-width: 768px) 448px, 358px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="flex items-center justify-between text-brand-purple/88">
                <Label>{post.category}</Label>
                <Label>{formatPostDate(stegaClean(post.date))}</Label>
              </div>
              <div className="font-heading text-h6">{post.title}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 flex justify-center md:mt-16">
        <a
          href={links.blog}
          aria-label={blog.nextPage}
          className="m-px flex items-center justify-center rounded-pill border border-brand-purple/16 px-3 py-2.5 text-brand-purple shadow-button backdrop-blur-[10px] transition-colors hover:border-paper/8 hover:bg-brand-purple/88 hover:text-paper md:px-4 md:py-3"
        >
          <ArrowLargeIcon className="h-5 w-5 md:h-6 md:w-6" />
        </a>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Replace `components/home/Contact.tsx`** (form stays a static placeholder, as documented in CLAUDE.md)

```tsx
import Button from "@/components/ui/Button";
import Label from "@/components/ui/Label";
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionLabel from "@/components/ui/SectionLabel";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_CONTACT_QUERY } from "@/sanity/queries";

const fieldStyles =
  "w-full rounded-lg border border-brand-purple/8 bg-brand-purple/8 px-3 py-2.5 md:px-4 md:py-3 text-brand-purple outline-none placeholder:text-brand-purple/48 focus:border-brand-purple/48 focus:bg-brand-purple/16";

export default async function Contact() {
  const [contact, links] = await Promise.all([fetchRequired(HOME_CONTACT_QUERY), getLinks()]);

  return (
    <Section
      top="md"
      bottom="md"
      className="bg-[url('/images/bg/purple-background.png')] bg-contain bg-fixed bg-center"
      backdrop={<div className="absolute inset-0 bg-brand-purple/32 backdrop-blur-[10px]" />}
    >
      <div className="rounded-panel bg-canvas p-8 text-brand-purple md:p-16">
        <div className="flex flex-col md:-mx-2.5 lg:flex-row">
          {/* Left: heading + partner logo marquee */}
          <div className="mb-12 flex flex-col justify-between gap-12 md:mb-16 md:gap-16 lg:mb-0 lg:w-1/2">
            <div className="flex flex-col items-start gap-4 md:gap-6">
              <h2 className="font-heading text-h2">{contact.title}</h2>
              {/* Matches the live site, where this paragraph is the same color as the panel. */}
              <p className="text-canvas">{contact.description}</p>
            </div>

            <div className="flex w-full flex-col items-start gap-6 border-t border-brand-purple/16 pt-6 md:gap-8 md:pt-8">
              <SectionLabel className="ml-[5px]">{contact.partnersLabel}</SectionLabel>
              <div className="relative flex h-[33px] w-full items-center overflow-hidden md:h-[47px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-14 bg-gradient-to-r from-paper to-transparent md:w-20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-14 bg-gradient-to-l from-paper to-transparent md:w-20" />
                <div className="flex w-max animate-marquee">
                  {[0, 1].map((copy) => (
                    <ul
                      key={copy}
                      aria-hidden={copy === 1}
                      className="flex shrink-0 items-center gap-20 pr-20"
                    >
                      {contact.partners.map((partner) => (
                        <li key={partner._key}>
                          <SanityImage
                            image={partner}
                            alt={copy === 0 ? undefined : ""}
                            width={160}
                            height={47}
                            className="h-auto w-40 max-w-none"
                          />
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: form.
              TODO: static placeholder. Wire up submission (Webflow form + Turnstile on the
              live site) once the backend is decided. The button links to the sign-up flow. */}
          <div className="flex flex-col items-start gap-4 pt-3.5 md:gap-5 md:pt-0 lg:w-1/2 lg:pb-5 lg:pl-content">
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-name" className="text-brand-purple/64">
                {contact.form.nameLabel}
              </Label>
              <input
                id="contact-name"
                type="text"
                placeholder={contact.form.namePlaceholder}
                className={fieldStyles}
              />
            </div>
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-email" className="text-brand-purple/64">
                {contact.form.emailLabel}
              </Label>
              <input
                id="contact-email"
                type="email"
                placeholder={contact.form.emailPlaceholder}
                className={fieldStyles}
              />
            </div>
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-message" className="text-brand-purple/64">
                {contact.form.messageLabel}
              </Label>
              <textarea
                id="contact-message"
                placeholder={contact.form.messagePlaceholder}
                className={`${fieldStyles} h-[125px] resize-y`}
              />
            </div>
            <Button href={links.apply} withArrow>
              {contact.form.submit}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Verify against the baseline**

```bash
npm run format && npm run lint && npm run build
npx next start -p 3100 &
sleep 4
node scripts/visual/check.mjs capture after-blog-contact
node scripts/visual/check.mjs compare baseline after-blog-contact
kill %1
```
Expected: `PASS` (all six section heights identical at all three widths).

- [ ] **Step 4: Manual check: zero and many posts (Review Focus 3)**

In `sanity/queries.ts` temporarily change `[0...3]` to `[0...0]`, run `npm run dev`, and confirm the Blog section shows its header and "See more" button with no cards and no error. Change it to `[0...10]` after adding a fourth post in Studio if you like; the shipped value must be `[0...3]`. Revert the edit and delete any test post.

- [ ] **Step 5: Commit**

```bash
git add components/home/Blog.tsx components/home/Contact.tsx
git commit -m "feat: read blog cards and contact section from Sanity" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Cutover: remove the old i18n/asset paths and update the docs

**Files:**
- Delete: `locales/`, `crowdin.yml`, `i18n/`, `lib/links.ts`, `studio/scripts/`, migrated files under `public/images/`
- Modify: `next.config.ts`, `app/layout.tsx`, `package.json`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Prove the old code is unreferenced**

```bash
grep -rn "next-intl\|getTranslations\|lib/links\|locales/" app components lib sanity next.config.ts i18n 2>/dev/null
```
Expected: matches only in `app/layout.tsx` (`getLocale`), `next.config.ts`, and `i18n/`. Anything in `components/` means a section was missed: fix it before continuing.

- [ ] **Step 2: Remove `next-intl` from the layout and config**

`app/layout.tsx`: delete the `getLocale` import and its call; set `<html lang="en" ...>`.
`next.config.ts` becomes:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 75 is the default; 90 is used for photos (see quality={90}).
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
```

- [ ] **Step 3: Delete the old sources and migrated images**

The migrated images are in Sanity now (Task 6 uploaded every file listed here).
```bash
git rm -r locales i18n crowdin.yml lib/links.ts studio/scripts
npm uninstall next-intl
git rm public/images/og-image.jpg public/images/hero/team-study-session.webp \
  public/images/values/study-kit.webp public/images/products/messenger-pigeon.webp \
  public/images/products/live-services.webp public/images/nav/group-study-session.webp \
  public/images/nav/mac-mini-privacy.webp \
  public/images/blog/messenger-pigeon-v2.jpg public/images/blog/university-of-ottawa.jpg \
  public/images/blog/wcag-compliance.jpg \
  public/images/logos/avatar-berkeley.webp public/images/logos/avatar-csuci.png \
  public/images/logos/avatar-harvard.webp public/images/logos/avatar-humber.png \
  public/images/logos/avatar-ivy-tech.webp public/images/logos/avatar-toronto.png \
  public/images/logos/city-of-toronto.png public/images/logos/csuci.png \
  public/images/logos/harvard.png public/images/logos/humber.png \
  public/images/logos/ivy-tech.png public/images/logos/uc-berkeley.png \
  public/images/logos/uoft.png public/images/logos/uws.png public/images/logos/yale.png
```
Also remove the two studio scripts from `studio/package.json` (`npm --prefix studio pkg delete scripts.seed scripts.verify-seed`) and the root `seed` script (`npm pkg delete scripts.seed`). Update the "no content found" hint in `sanity/lib/assert-found.ts` and its test if you keep a seed reference: replace `Run "npm run seed" in studio/.` with `Create the document in the Studio.` in `assert-found.ts` and the layout's `generateMetadata` error message, and change the test regex `/seed/i` to `/Studio/`.

- [ ] **Step 4: Confirm nothing points at a removed file**

```bash
grep -rn "/images/" app components | grep -v node_modules
```
Expected: only these local paths remain: `/images/logos/habitat-learn-logo-colour.png`, `/images/logos/habitat-learn-logo-white.png`, `/images/hero/grow.png`, `/images/hero/hero-video-poster.jpg`, `/images/nav/mp-clip-poster.jpg`, `/images/icons/*.svg`, `/images/bg/purple-background.png`.

- [ ] **Step 5: Update `CLAUDE.md`**

Change these parts (keep everything else):
- Intro: replace "must stay easy to edit in Onlook and to translate in Crowdin" with "must stay easy to edit in Onlook (layout, classes) and Sanity (copy, images, links)".
- Non-negotiable 2 → "**No hard-coded user-facing text.** Every visible string, `alt` and `aria-label` comes from Sanity (`homePage-en` for sections, `siteSettings-en` for nav, footer, meta and links), read with the queries in `sanity/queries.ts`. The one exception is the editor-only Draft Mode button."
- Non-negotiable 4 → "**Local assets for static UI only.** Icons, fonts, favicons, the hero and nav videos and their posters live in `public/`. Editor-managed images come from Sanity via `<SanityImage>`. Never hotlink Webflow's CDN. Never serve video from Sanity."
- Structure rules: replace "`getTranslations`" with "`fetchRequired(<QUERY>)` and `getLinks()`" and replace "Outbound links live in `lib/links.ts`…" with "Outbound links live in `siteSettings-en.links` (blog post links on the `post` document)."
- Replace the "Adding a language" section with: "Adding a language: create `homePage-<code>` / `siteSettings-<code>` documents (see `docs/superpowers/specs/2026-09-24-sanity-cms-integration-design.md`) and route by locale. This needs real routing work; it is not a config change."
- Add a "Working with Sanity" section: Studio in `studio/` (`npm run dev` there → http://localhost:3333, deployed with `npx sanity deploy`); run `npm run typegen` after changing schemas or queries; strings that drive logic go through `stegaClean`; `generateMetadata` uses `stega: false`; Onlook edits classes only, so change text in Sanity.
- "Known deviations": remove the sentence about typos being preserved "on purpose in `home.json`" and replace with "The live copy typos (`thatremoves`, `highquality`, `empowerstudents`, `toreach`) are still in the Sanity content on purpose; fix them in Sanity if the live site is corrected."

- [ ] **Step 6: Update `README.md`**

Replace the Crowdin/translation mentions and the project-structure block with the new layout (`studio/`, `sanity/`, no `locales/`/`i18n/`/`lib/links.ts`), and add: "Environment: `SANITY_API_READ_TOKEN` (Viewer token; Draft Mode only; set as a Workers secret with `npx wrangler secret put SANITY_API_READ_TOKEN`), `NEXT_PUBLIC_SANITY_STUDIO_URL` (deployed Studio URL). Run the Studio with `cd studio && npm run dev`." Remove the `SITE_LOCALE` note.

- [ ] **Step 7: Full gate**

```bash
npm run format && npm run lint && npm test && npm run build
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove locale JSON, next-intl, Crowdin, and migrated local images" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Final verification and deploy

**Files:** none (verification and deployment), plus updates to `.env.local`/Workers config outside git.

- [ ] **Step 1: Regression gate against the baseline (final code)**

```bash
npm run build
npx next start -p 3100 &
sleep 4
node scripts/visual/check.mjs capture final
node scripts/visual/check.mjs compare baseline final
kill %1
```
Expected: `PASS`; 1440 heights `[1439,1087,1189,928,839,533]`.

- [ ] **Step 2: Stega must not leak (Review Focus 4)**

Published (no Draft Mode): 
```bash
npx next start -p 3100 &
sleep 4
curl -s http://localhost:3100 | grep -c $'\xe2\x80\x8b\|\xe2\x80\x8c\|\xe2\x80\x8d\|\xef\xbb\xbf' || true
kill %1
```
Expected: `0` (no zero-width characters in the published HTML). Draft Mode: run `npm run dev`, open Studio → Presentation → site, then in the iframe's console (or open the site in the Presentation "window" view) run:
```js
[...document.querySelectorAll('a[href]')].filter((a) => /[^\x20-\x7E]/.test(a.getAttribute('href'))).length
```
Expected: `0`. Also `document.querySelector('title').textContent` and `document.documentElement.lang` contain no zero-width characters.

- [ ] **Step 3: Image edge cases (Review Focus 5)**

In Studio → Presentation, apply a crop to one blog card image and to the team photo: the preview updates and the image still renders, cropped. Remove one hero avatar from the array: the row renders with one fewer avatar and no error.

- [ ] **Step 4: Presentation smoke test**

In Presentation: click the hero title, edit it, see it change live; click a footer link label; click a blog card title; edit a nav label; publish. Confirm the published change appears on `http://localhost:3000` after a refresh, then revert the edit.

- [ ] **Step 5: Cloudflare build**

```bash
npm run cf:build
```
Expected: succeeds; note the worker size and confirm it is under the platform limit. Run `npm run cf:preview` and re-check the homepage at `http://localhost:8787`, including images.

- [ ] **Step 6: [USER-CONFIRM] Deploy the site**

With the user's yes:
```bash
npx wrangler secret put SANITY_API_READ_TOKEN      # user pastes the Viewer token
echo "NEXT_PUBLIC_SANITY_STUDIO_URL=<deployed studio URL, from step 7>" >> .env.local   # do this after step 7, then redeploy
npm run cf:deploy
```
Expected: prints `https://habitat-test-rebuild.jake-cogan.workers.dev` (or the current worker URL). Load it and compare visually with the baseline: `node scripts/visual/check.mjs capture live https://<worker-url>` then `compare baseline live` (expect `PASS`).

- [ ] **Step 7: [USER-CONFIRM] Deploy the Studio and allow the live origin**

```bash
(cd studio && npx sanity cors add https://habitat-test-rebuild.jake-cogan.workers.dev --credentials)
(cd studio && SANITY_STUDIO_PREVIEW_ORIGIN=https://habitat-test-rebuild.jake-cogan.workers.dev npx sanity deploy)
```
`sanity deploy` asks for a hostname; the user picks it (for example `habitat-learn`). Put the resulting `https://<hostname>.sanity.studio` into `.env.local` as `NEXT_PUBLIC_SANITY_STUDIO_URL`, then re-run `npm run cf:deploy`.

- [ ] **Step 8: Live publish test**

Open the deployed Studio → Presentation (it loads the deployed site). Edit the hero description, publish, reload the deployed site: the change appears within about a minute (KV tag cache consistency window; a refresh may be needed). Revert the edit and publish again. Record the result in the results file, then commit it.

- [ ] **Step 9: Finish the branch**

```bash
git add -A
git commit -m "docs: record final verification results" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push -u origin sanity-integration
```
Then use superpowers:finishing-a-development-branch (open the PR against `homepage-rebuild`, since PR #1 is not merged yet).

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| 1 Goal/success criteria (edit → live, blog docs, identical visuals, Onlook classes) | 5-6, 8-11, 13 |
| 2 Decisions (scope, Sanity replaces JSON, standalone Studio, approach A + B fallback) | 2, 3, 3B, 12 |
| 3 Architecture, repo hygiene (`studio/` move, tsconfig/ESLint/Prettier excludes) | 2 |
| 3 Cloudflare/OpenNext gate and KV caches | 3, 3B |
| 4 Content model (`homePage`, `siteSettings`, `post`, links registry, arrays vs named) | 5, 6 |
| 4 Stays in code (video, icons, `grow.png`, fonts) | Global Constraints, 9, 12 |
| 5 Frontend (`sanity/` module, section rewrites, `SanityImage`, layout, stega, removals) | 3, 7-12 |
| 6 Studio (structure, Presentation locations, typegen, deploy, CORS) | 3, 5, 13 |
| 7 Migration (seed, round-trip check, switch per section, visual verification, cutover) | 6, 8-12 |
| 8 CLAUDE.md rule changes | 12 |
| 9 Environment and secrets | 3, 13 |
| 10 Testing strategy | 1, 4, 6, 13 |
| 11 Out of scope | not implemented (correct) |

Deviations from the spec, made deliberately and already recorded in it: hotspot is not turned into `object-position` (inline `style` is banned), so only the editor's crop is honoured; Prettier is not excluded for `studio/` (it has its own config), only for `docs/` and generated types; `next-sanity` 13 API names replace the older names in Sanity's reference file.

**Placeholders:** none in code steps. The only fill-ins are runtime values that come from tools (KV namespace ids printed by wrangler, the Studio hostname chosen at `sanity deploy`, the user's token).

**Type/name consistency:** singleton IDs `homePage-en`/`siteSettings-en`, query names (`HOME_*`, `SITE_*`), helper names (`fetchRequired`, `getSiteSettings`, `getLinks`, `assertFound`, `formatPostDate`, `SanityImage`) and schema field names are identical across Tasks 5-11. `products.items` is a named object with keys `messengerPigeon`/`podium`/`liveServices` in both the schema (Task 5) and `Products.tsx` (Task 10); `hero.avatars`/`contact.partners` are arrays with `_key` in the schema, seed, and components.

**Review Focus coverage:** items 1 and 2 have tests (Task 4, run under three time zones); 3, 4 and 5 have explicit checks (Tasks 11, 13).
