# Multi-language via Crowdin: design

Date: 2026-09-25. Status: v4 (approved for planning), awaiting review. Assumptions confirmed: Portuguese is `pt-BR`, Norwegian is Bokmal `nb`. Supersedes v1 (Tinloof plugin, per-language documents,
debounce and queue tool).

## 1. Goal

Editors write English in Sanity and press Publish as often as they like. Translations follow through
Crowdin, when an editor presses **Translate all changes**, and show at `/<lang>`. English stays at `/`. Rollout starts with Arabic (right-to-left), Spanish and Japanese; the pipeline is generic.
The site gets a language switcher in the nav.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Source of truth | English content in `homePage-en`, `siteSettings-en` (and posts). Editors only edit English. |
| Sync model | Manual: a **Translate all changes** button in the Studio runs the sync (content-hash check, pushes only changed documents). Not triggered per publish. No debounce, no queue, no scheduler. A schedule can call the same route later if editors forget. |
| Format | Extract only translatable strings, keyed by stable path (`_key`-based for arrays). Push to Crowdin as a flat string file. The string's key path (e.g. `hero.primaryCta`) is the translator's context. Everything is translatable by default; links, keys, dates, URLs and `variant` are skipped by rule (`lib/crowdin/extract.ts`), and `npm run translations:check` fails when the set of translatable keys differs from the committed snapshot, so new keys are reviewed in the PR diff. |
| Storage of translations | One `translation-<lang>-<sourceId>` Sanity document per language and source document (e.g. `translation-ar-homePage-en`), chosen over KV so edit history and rollback come free and concurrent writes cannot collide. Merged at render time. No per-language copies of content documents. |
| Tools | Official `@crowdin/crowdin-api-client`. No third-party Sanity/Crowdin plugin. |
| Update safety | File updates use `updateOption = clear_translations_and_approvals`: changed strings are cleared in Crowdin and re-translated (an old translation of a changed sentence would be wrong); unchanged strings keep theirs. The site keeps showing the previous stored translation until the new one is complete. |
| Approval | Not required for now (machine pre-translation). Each locale has a status in Sanity (`siteSettings.languages`): `off` (default; nothing pushed or pre-translated), `preview` (reachable by URL, hidden from the switcher, `noindex`), `live` (in the switcher, indexed). Marketing flips it in Studio, no deploy. |
| Completeness | A language is written back only when its file is fully translated; the previous translation stays until then. |
| Missing translation | Fall back to English (only for never-translated content). |
| URLs | English at `/`, others at `/<lang>`. Unknown or disabled locales 404. |
| Switcher copy | Language names, aria-label and status come from `siteSettings-en` (and its translations), not JSX. Each name carries its own `lang` attribute. |
| Secrets | `CROWDIN_API_TOKEN`, `CROWDIN_PROJECT_ID` in `.env.local` and Cloudflare secrets. Never in chat or git. |

## 3. Editor workflow

1. Edit `homePage-en`, see it in Presentation, Publish. English is live immediately.
2. Whenever ready (after one edit or many), open the Studio "Translations" tool and press **Translate all changes**.
   The tool shows how many documents changed since the last translation ("3 documents changed" or "All up to date").
3. The sync pushes only the changed strings to Crowdin. Crowdin pre-translates. When a language is complete, the
   webhook stores it and the site revalidates.
4. The tool also shows last sync time and per-language status.

## 4. Components

1. **Extractor** (`lib/crowdin/extract.ts`): Sanity English document to `{ key: string }` map, and a merge function
   back into query results. Pure functions, unit tested.
2. **Sync route** (`app/api/crowdin/sync/route.ts`): hashes the extracted map per document, pushes to Crowdin only
   when the hash changed, records hash and time. Auth: the Studio tool writes `requestedAt` on the `translationStatus` document with the editor's own Studio login, so Sanity enforces who may trigger a sync; a Sanity webhook on that change calls the route, which verifies the webhook signature (same mechanism as `/api/revalidate`). No token or secret ships in the Studio bundle. Only `preview` and `live` languages are pre-translated. Crowdin is called with plain `fetch` (the official client depends on axios, a risk on Workers). One push at a time (optimistic lock on the status document); a second
   press while one runs is a no-op. A second Sanity webhook on publish (`/api/crowdin/changed`) recomputes `pendingCount` without calling Crowdin.
3. **Crowdin webhook route** (`app/api/crowdin/route.ts`): authenticates with a shared secret sent as a custom header (Crowdin's project-webhook signing scheme is not documented; custom headers are), and on `file.translated` and `file.approved` downloads the
   translations under the same completeness guard, stores them, revalidates by tag.
4. **Locale routing**: single locale config (default, supported, direction, Crowdin id, URL code; status lives in Sanity). `app/[locale]/page.tsx` for
   non-default locales. Queries take a locale and merge stored translations over English.
5. **RTL**: `<html lang dir>` from config. Logical Tailwind utilities (`ms/me/ps/pe/start/end`) in place of
   physical ones, `rtl:` variants where direction matters. Arabic-capable font in `public/` if needed.
6. **Language switcher** (`components/layout/`): CSS-only dropdown matching the nav pattern, links to the same
   page in the other locale, lists only `live` locales. Locale codes pass through `stegaClean`.
7. **Metadata and SEO**: per-locale `generateMetadata` with hreflang alternates, `noindex` for `preview` locales, and a sitemap with per-locale alternates.
8. **Studio "Translations" tool** (phase 1): custom Studio tool with the **Translate all changes** button, the
   pending-changes counter, and per-language status. Reads `translationStatus` live and triggers a sync by writing `requestedAt`.
9. **Direction guard**: a lint or test check that fails on physical direction utilities (`ml-`, `mr-`, `pl-`, `pr-`,
   `left-`, `right-`, `text-left`, `text-right`, `border-l/r`, `rounded-l/r`) so Onlook edits cannot reintroduce them.
   CLAUDE.md gets a Locales section (logical utilities only; adding a language) replacing "Adding a language".

## 4a. Languages

Source: English. Targets configured in Crowdin (all in the locale config, gated by status): Chinese (Simplified
and Traditional), Spanish, French, German, Japanese, Korean, Portuguese, Italian, Arabic (RTL), Hindi, Dutch,
Swedish, Danish, Norwegian, Finnish, Romanian.

- Rollout: Arabic, Spanish, Japanese first (RTL, accented Latin, CJK); enable the others after the pipeline is proven.
- Non-Latin scripts (Chinese, Japanese, Korean, Hindi, Arabic): system font stacks for CJK; self-host Arabic and
  Hindi faces only if system fallbacks look poor.
- Long-word languages (German, Finnish, Dutch): layout check of nav, buttons, headings at 390 / 820 / 1440.
- Switcher: 17 entries need a scrollable or multi-column panel; names in their own script from Sanity.
- URL codes map from Crowdin ids in the locale config (assumed: `zh-CN`, `zh-TW`, Portuguese as `pt-BR`,
  Norwegian as Bokmal `nb`; confirmed).

## 4b. Delivery automation (separate phase)

Goal: after a change through Claude Code, nothing is manual except asking for it.

- Claude pushes a branch, opens a PR, waits for checks (lint, tests, build) and merges when green. Standing
  permission recorded in CLAUDE.md; branch protection on `main` blocks merging red builds.
- GitHub Actions on merge to `main`: site repo deploys to Cloudflare; Studio repo runs `sanity deploy`.
- Secrets added by the team in GitHub (never in chat): Cloudflare API token, Sanity deploy token.
- Prerequisite: the Studio repo needs a GitHub remote (unconfirmed).
- CLAUDE.md gets a "new section" checklist: schema, starter content in Sanity, typegen, tests, then push and merge.
- Marketer path: ask Claude, check localhost, done. Editing copy afterwards happens in the deployed Studio.

## 5. Risks and open questions

- Manual trigger means translations go stale if editors forget; the pending-changes counter is the mitigation. A
  schedule calling the same route is the escalation.
- Crowdin rate limits and concurrent-update ordering are not documented in what I found; the manual, one-push-at-a-time
  design avoids depending on either.
- Machine translation quality varies by language; glossary for brand terms and "do not translate" words in Crowdin.
- Regional codes (`pt-BR`, `zh-CN`) need a mapping to clean URLs (in the locale config).
- Scripts beyond Latin/Arabic may need extra fonts; the RTL sweep touches many components.
- Translated content is not editable in Presentation (by design). Confirm with an actual editor that this is fine.
- Pre-translation costs credits per language per push; limiting it to `preview`/`live` languages is the control.
- Content scope: homepage card title and excerpt are translated; blog post pages link out and stay English.
- Crowdin webhook needs a public URL; local testing needs a tunnel or a deployed preview.

## 6. Testing

Unit: extractor, hash-change detection, merge and fallback, locale resolution, webhook signature verification,
switcher link building. End to end: publish an English edit, press Translate all changes, confirm the string appears in Crowdin,
translate it, confirm it renders at `/ar` and English is untouched. Screenshots: `/` identical before and after;
`/ar` at 1440, 820, 390. Also: webhook auth (rejects missing and wrong signatures and secrets), the direction guard (fails on `ml-4`), the
key-snapshot check, and a switcher accessibility check (`lang` attributes). `npm run format`, `lint`,
`typegen`, `build` pass.

## 7. Out of scope

Approval workflows, blog post pages (posts link out and stay English; only card text on the homepage is translated), a translated contact-form backend, automatic
locale detection or redirects, and languages beyond the initial set.
