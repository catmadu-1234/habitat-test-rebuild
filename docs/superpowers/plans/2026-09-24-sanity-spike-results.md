# Cloudflare gate results (plan Task 3)

Decision: **approach A** (`next-sanity` 13 `defineLive`, `cacheComponents` unset), with one change: a custom
`SanityLive` action that expires tags immediately.

| # | Check | Result | Evidence |
| - | ----- | ------ | -------- |
| 1 | `next build` with `cacheComponents` unset; `/` stays static; published data at build | PASS | `/` and `/spike` prerendered (○); clean build renders "Spike v1"; no `cacheTag` error |
| 2 | Image optimisation on Workers | PASS | `/_next/image?url=cdn.sanity.io/...` → 200 `image/jpeg` via the Images binding |
| 3 | Publish propagation (local Workers preview, local KV) | PASS with a change | Default action (`revalidateTag(tag, "max")`) logged success but pages kept serving cache HIT for 2+ min. Custom action `revalidateTag(tag, { expire: 0 })` refreshed the page in ~9 s |
| 4 | Draft Mode + Presentation | PASS | Presentation loaded the local site, overlay + "Documents on this page" listed the document |
| 5 | Worker size | PASS | 7540 KiB raw / 1590 KiB gzip |

Notes
- A build made before content exists caches "no result" (`revalidate: false`), so `prebuild` now clears
  `.next/cache/fetch-cache` and the `cf:*` scripts remove `.next` first.
- Real Cloudflare KV is eventually consistent (up to ~60 s); re-check the publish delay after the first deploy.
- Node 25 prints a harmless `--localstorage-file` warning during builds.
