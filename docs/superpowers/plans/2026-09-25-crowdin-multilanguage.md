# Crowdin Multi-language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors write English in Sanity and press Publish; a **Translate all changes** button in the Studio sends only the changed strings to Crowdin, machine-translates them, and the translations appear at `/<lang>` (English stays at `/`), with a nav language switcher and right-to-left support for Arabic.

**Architecture:** English content stays in `homePage-en`, `siteSettings-en` and `post` documents. A pure extractor turns each into a flat `{ keyPath: string }` map; a sync engine (dependency-injected, unit tested) hashes each map, pushes changed files to Crowdin over plain `fetch`, pre-translates enabled languages, and stores finished translations as `translation-<lang>-<sourceId>` Sanity documents that are merged over the English data at render time. The Studio button writes `requestedAt` on a `translationStatus` document; a signed Sanity webhook calls the site's sync route. Locale routing uses two root layouts (`app/(en)` for `/`, `app/[locale]` for the rest), so no middleware/proxy is needed.

**Tech Stack:** Next.js 16 (App Router), Tailwind v3, `next-sanity` 13, Sanity Studio 6, Crowdin REST API v2 (via `fetch`), Cloudflare Workers via OpenNext, `node --test` (Node 25, TypeScript type stripping).

**Spec:** `docs/superpowers/specs/2026-09-25-crowdin-multilanguage-design.md` (v4). Delivery automation (spec section 4b: auto-merge and auto-deploy) is deliberately **not** in this plan; it is a separate plan because it is independent of translations.

## Global Constraints

Copied from the spec and `CLAUDE.md`; every task inherits them.

- **Tailwind classes only** on JSX. No CSS modules, CSS-in-JS, `@apply`, inline `style=`, or new UI libraries. Class strings must be complete literals.
- **No hard-coded user-facing text** in the site. Language names, the switcher `aria-label`, and all copy come from Sanity (`siteSettings-en`, `homePage-en`, `post`). Studio-only UI text (the Translations tool) is allowed.
- **Named tokens, not raw values** (`tailwind.config.ts`); never a hex value in a component. Arbitrary values only for genuine one-offs.
- **Logical direction utilities only** (`ms/me/ps/pe/start/end`, `text-start/end`); physical ones (`ml/mr/pl/pr/left/right/text-left/text-right/border-l/r/rounded-l/r`) only on a line that also has an `rtl:`/`ltr:` variant. Enforced by a test (Task 9).
- **Components:** one component per homepage section in `components/home/`, shared chrome in `components/layout/`, small pieces in `components/ui/`. Async server components; `"use client"` only for real interactivity.
- **Strings that drive logic** (locale codes, statuses, URLs) go through `stegaClean`; metadata fetches use `stega: false`.
- **URLs:** English at `/` (unchanged), other locales at `/<code>`; `/en` and unknown or `off` locales 404.
- **Update safety:** Crowdin file updates use `updateOption: "clear_translations_and_approvals"`; the site keeps the previous stored translation until a new complete one replaces it; a language is written back only when its file is 100% translated.
- **No new site dependencies.** Crowdin is called with `fetch` (the official client depends on axios, a risk on Workers). The Studio adds only `@sanity/ui`.
- **Secrets** (`CROWDIN_API_TOKEN`, `CROWDIN_PROJECT_ID`, `CROWDIN_WEBHOOK_SECRET`, `SANITY_API_WRITE_TOKEN`) live in `.env.local`, `.dev.vars` and Cloudflare secrets; never in git or chat.
- **Before every commit on the site repo:** `npm run format`, `npm run lint`, `npm test`, and (where markup or config changed) `npm run build`, all clean. Studio repo: `npx tsc --noEmit` and `npm run build`.
- **Next.js 16 differs from older versions:** `params` is a `Promise`; read `node_modules/next/dist/docs/` before using a Next API not shown in this plan.
- **Branches:** site repo `crowdin-i18n` cut from `sanity-integration`; Studio repo `crowdin-i18n` cut from `main`. Do not merge or deploy without the user's go-ahead.

## Review Focus

Inputs the spec implies but a happy-path test would miss. Each has a test in the named task.

1. **A translation document with corrupt or non-object JSON** must never break a page; the page shows English. (Task 2, `parseStrings` tests.)
2. **A translation that is missing a key, or has an empty string for it,** falls back to the English string for that key. (Task 2, `applyTranslations` tests.)
3. **`/en`, `/xx`, and a language whose status is `off`** return 404, so English never exists at two URLs and unfinished languages are not reachable. (Task 4 `statusFor` tests; Task 6 curl checks.)
4. **Double press of Translate all changes, and a Crowdin failure mid-sync:** the second press is a no-op; a failure records `lastError`, clears `running`, does not record hashes for files whose pre-translation failed (so the next press retries), and the site keeps serving the previous translations. (Task 11.)
5. **A Crowdin webhook for an unknown file, an inactive language, or an incomplete file** must be ignored with HTTP 200 (a non-2xx makes Crowdin retry), while a wrong secret is 401. (Tasks 11 and 13.)

## File Structure

**Site repo (`habitat-rebuild-test`)**

| File | Responsibility |
| --- | --- |
| `lib/locales.ts` | Locale config (code, Crowdin id, `<html lang>`, direction), `localePath`. Pure. |
| `lib/languages.ts` | `statusFor`, `liveLanguages`, `activeLocales` over Sanity `languages` rows. Pure. |
| `lib/site-url.ts` | Absolute site origin for hreflang/sitemap. |
| `lib/crowdin/extract.ts` | `extractStrings`, `applyTranslations`, `hashStrings`, `parseStrings`. Pure, no `@/` imports. |
| `lib/crowdin/ids.ts` | `translationId`, `storeKey`. Pure. |
| `lib/crowdin/source-docs.ts` | Which Sanity documents are translated (ids + posts query). |
| `lib/crowdin/port.ts` | `CrowdinPort` interface and the `fetch`-based `createCrowdinPort`. |
| `lib/crowdin/sync.ts` | `runSync`, `handleFileEvent`, `computePending` over injected `SyncDeps`. Pure logic. |
| `lib/crowdin/webhook.ts` | `isAuthorized` (constant-time), `parseFileEvents`. Pure. |
| `lib/direction-guard.ts` | Regex for physical direction utilities. |
| `sanity/lib/localize.ts` | Fetch a translation document and merge it over English data. |
| `sanity/lib/languages.ts` | `getLanguages`, `requireAvailableLocale`. |
| `sanity/lib/write-client.ts`, `crowdin-deps.ts`, `webhook.ts` | Server-only Sanity write client, real `SyncDeps`, Sanity-webhook signature check. |
| `sanity/lib/build-metadata.ts` | Per-locale `generateMetadata` (hreflang, noindex). |
| `app/fonts.ts` | Font loaders (moved out of the old root layout). |
| `app/(en)/layout.tsx`, `app/(en)/page.tsx` | English root layout and page at `/`. |
| `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` | Locale root layout (gated) and page. |
| `app/sitemap.ts` | Sitemap with per-locale alternates. |
| `app/api/crowdin/{sync,changed}/route.ts`, `app/api/crowdin/route.ts` | Sync trigger, pending recompute, Crowdin webhook. |
| `components/layout/SiteShell.tsx`, `LanguageSwitcher.tsx` | Shared `<html>` shell; CSS-only language dropdown/list. |
| `components/home/HomePage.tsx` | Assembles the five sections for a locale. |
| `scripts/crowdin-info.mjs`, `scripts/translations-keys.ts` | List Crowdin languages/engines; key-snapshot check. |

**Studio repo (`../studio-habitat-learn-test`)**

| File | Responsibility |
| --- | --- |
| `schemaTypes/shared/language-codes.ts` | Allowed language codes and statuses. |
| `schemaTypes/objects/language-entry.ts` | `{code, nativeName, status}` object. |
| `schemaTypes/documents/translation.ts`, `translation-status.ts` | Read-only store and sync-status documents. |
| `tools/translations/TranslationsTool.tsx`, `index.ts` | Studio "Translations" tab. |
| `scripts/seed-translations.ts` | One-time: languages list, `nav.languageMenu`, status doc. |

---

### Task 0: Branches, baseline, environment

**Files:** none changed (git state, `.visual/` baseline).

- [ ] **Step 1: Cut branches**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test && git switch sanity-integration && git switch -c crowdin-i18n
cd ../studio-habitat-learn-test && git switch main && git switch -c crowdin-i18n
```

Expected: `Switched to a new branch 'crowdin-i18n'` in both.

- [ ] **Step 2: Confirm tests and build are green before touching anything**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test && npm test && npm run lint && npm run build
```

Expected: all pass. If not, stop and report; do not build on a red base.

- [ ] **Step 3: Capture the pixel baseline for English**

Follow `CLAUDE.md` "Verifying visual changes" and set `CHROME_PATH` to a Chromium binary (see `docs/superpowers/plans/2026-09-24-sanity-cms-integration.md`, Task 1, if unsure; run `npm ci` in `scripts/visual` once).

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test && npm run build && (npx next start -p 3100 &) && sleep 5 && node scripts/visual/check.mjs capture before http://localhost:3100
```

Expected: `.visual/before/` contains screenshots for 1440, 820 and 390. Leave the server running for later comparisons or stop it and restart as needed (`lsof -ti:3100 | xargs kill`).

No commit (baseline images are git-ignored).

---

### Task 1: Locale config

**Files:**
- Create: `lib/locales.ts`
- Test: `lib/locales.test.ts`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Produces: `type Direction`, `type LocaleConfig = { code: string; crowdinId: string; htmlLang: string; dir: Direction }`, `DEFAULT_LOCALE: "en"`, `LOCALES: readonly LocaleConfig[]`, `NON_DEFAULT_LOCALES`, `getLocale(code): LocaleConfig | undefined`, `localePath(code, path = "/"): string`.

- [ ] **Step 1: Write the failing test** (`lib/locales.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOCALE, LOCALES, NON_DEFAULT_LOCALES, getLocale, localePath } from "./locales.ts";

test("codes and Crowdin ids are unique, and codes are lowercase URL segments", () => {
  const codes = LOCALES.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(LOCALES.map((l) => l.crowdinId)).size, LOCALES.length);
  for (const code of codes) assert.match(code, /^[a-z]{2}(-[a-z]{2})?$/);
});

test("English is the default and left-to-right; Arabic is the only right-to-left locale", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(getLocale("en")?.dir, "ltr");
  assert.deepEqual(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code), ["ar"]);
  assert.ok(NON_DEFAULT_LOCALES.every((l) => l.code !== "en"));
});

test("maps the agreed regional variants", () => {
  assert.equal(getLocale("pt-br")?.crowdinId, "pt-BR");
  assert.equal(getLocale("zh-cn")?.htmlLang, "zh-CN");
  assert.equal(getLocale("zh-tw")?.crowdinId, "zh-TW");
  assert.equal(getLocale("nb")?.crowdinId, "nb");
});

test("getLocale is exact: unknown, uppercase and empty codes are not locales", () => {
  assert.equal(getLocale("xx"), undefined);
  assert.equal(getLocale("AR"), undefined);
  assert.equal(getLocale(""), undefined);
});

test("localePath keeps English at the root and prefixes the rest", () => {
  assert.equal(localePath("en"), "/");
  assert.equal(localePath("ar"), "/ar");
  assert.equal(localePath("ar", "/"), "/ar");
  assert.equal(localePath("zh-cn", "/about"), "/zh-cn/about");
  assert.equal(localePath("en", "/about"), "/about");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test lib/locales.test.ts`
Expected: FAIL, `Cannot find module './locales.ts'`.

- [ ] **Step 3: Implement** (`lib/locales.ts`)

```ts
export type Direction = "ltr" | "rtl";

export type LocaleConfig = {
  /** URL segment and part of Sanity document ids. Lowercase. */
  code: string;
  /** Language id in the Crowdin project. */
  crowdinId: string;
  /** Value for <html lang> and hreflang. */
  htmlLang: string;
  dir: Direction;
};

export const DEFAULT_LOCALE = "en";

// Which of these are visible is decided per language in Sanity (siteSettings.languages status).
// Adding a language: add it here AND to schemaTypes/shared/language-codes.ts in the Studio repo.
export const LOCALES: readonly LocaleConfig[] = [
  { code: "en", crowdinId: "en", htmlLang: "en", dir: "ltr" },
  { code: "zh-cn", crowdinId: "zh-CN", htmlLang: "zh-CN", dir: "ltr" },
  { code: "zh-tw", crowdinId: "zh-TW", htmlLang: "zh-TW", dir: "ltr" },
  { code: "es", crowdinId: "es", htmlLang: "es", dir: "ltr" },
  { code: "fr", crowdinId: "fr", htmlLang: "fr", dir: "ltr" },
  { code: "de", crowdinId: "de", htmlLang: "de", dir: "ltr" },
  { code: "ja", crowdinId: "ja", htmlLang: "ja", dir: "ltr" },
  { code: "ko", crowdinId: "ko", htmlLang: "ko", dir: "ltr" },
  { code: "pt-br", crowdinId: "pt-BR", htmlLang: "pt-BR", dir: "ltr" },
  { code: "it", crowdinId: "it", htmlLang: "it", dir: "ltr" },
  { code: "ar", crowdinId: "ar", htmlLang: "ar", dir: "rtl" },
  { code: "hi", crowdinId: "hi", htmlLang: "hi", dir: "ltr" },
  { code: "nl", crowdinId: "nl", htmlLang: "nl", dir: "ltr" },
  { code: "sv", crowdinId: "sv", htmlLang: "sv", dir: "ltr" },
  { code: "da", crowdinId: "da", htmlLang: "da", dir: "ltr" },
  { code: "nb", crowdinId: "nb", htmlLang: "nb", dir: "ltr" },
  { code: "fi", crowdinId: "fi", htmlLang: "fi", dir: "ltr" },
  { code: "ro", crowdinId: "ro", htmlLang: "ro", dir: "ltr" },
];

export const NON_DEFAULT_LOCALES = LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE);

export function getLocale(code: string): LocaleConfig | undefined {
  return LOCALES.find((locale) => locale.code === code);
}

// English lives at the root; every other locale is a prefix.
export function localePath(code: string, path = "/"): string {
  if (code === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${code}` : `/${code}${path}`;
}
```

- [ ] **Step 4: Extend the test script** in `package.json`

Replace the `"test"` line with:

```json
    "test": "node --test lib/*.test.ts lib/crowdin/*.test.ts sanity/lib/*.test.ts",
```

- [ ] **Step 5: Run and confirm PASS**

Run: `npm test`
Expected: all pass (the new file plus the existing three).

- [ ] **Step 6: Commit**

```bash
npm run format && git add lib/locales.ts lib/locales.test.ts package.json && git commit -m "feat: add locale config and localePath

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: String extraction, merge and hashing

**Files:**
- Create: `lib/crowdin/extract.ts`, `lib/crowdin/ids.ts`
- Test: `lib/crowdin/extract.test.ts`

**Interfaces:**
- Produces:
  - `type StringMap = Record<string, string>`
  - `extractStrings(doc: unknown, prefix?: string): StringMap`
  - `applyTranslations<T>(data: T, map: StringMap, prefix?: string): T`
  - `hashStrings(map: StringMap): Promise<string>` (hex SHA-256, key-order independent)
  - `parseStrings(json: unknown): StringMap | null`
  - `translationId(code: string, sourceId: string): string` -> `translation-<code>-<sourceId>`
  - `storeKey(code: string, sourceId: string): string` -> `<code>__<sourceId>`
- Key format: object keys joined with `.`; array items as `[<_key>]` (or `[<index>]` if no `_key`). Keys are relative to the document root, or to `prefix` when a sub-tree (e.g. the `hero` section) is passed.

- [ ] **Step 1: Write the failing tests** (`lib/crowdin/extract.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTranslations, extractStrings, hashStrings, parseStrings } from "./extract.ts";
import { storeKey, translationId } from "./ids.ts";

const home = {
  _id: "homePage-en",
  _type: "homePage",
  _rev: "abc",
  language: "en",
  hero: {
    label: "Habitat",
    title: "Learn together",
    trustedBy: "Trusted by schools",
    avatars: [
      { _key: "a1", _type: "imageWithAlt", alt: "School one", asset: { _ref: "image-1", _type: "reference" } },
      { _key: "b2", _type: "imageWithAlt", alt: "School two", asset: { _ref: "image-2", _type: "reference" } },
    ],
  },
};

test("extracts copy with dotted paths and _key-based array segments", () => {
  assert.deepEqual(extractStrings(home), {
    "hero.label": "Habitat",
    "hero.title": "Learn together",
    "hero.trustedBy": "Trusted by schools",
    "hero.avatars[a1].alt": "School one",
    "hero.avatars[b2].alt": "School two",
  });
});

test("skips underscore fields, language, variant, date, url, href, links and languages subtrees", () => {
  const map = extractStrings({
    _id: "siteSettings-en",
    language: "en",
    variant: "primary",
    date: "2026-08-01",
    url: "https://example.com/post",
    href: "/x",
    links: { home: "https://habitatlearn.com" },
    languages: [{ _key: "ar", code: "ar", nativeName: "العربية", status: "live" }],
    meta: { title: "Habitat Learn" },
  });
  assert.deepEqual(map, { "meta.title": "Habitat Learn" });
});

test("skips empty strings, absolute URLs and ISO dates by shape, and non-strings", () => {
  const map = extractStrings({
    a: "  ",
    b: "https://example.com",
    c: "2026-09-25T10:00:00Z",
    d: 42,
    e: true,
    f: null,
    g: "Real copy",
  });
  assert.deepEqual(map, { g: "Real copy" });
});

test("falls back to the array index when an item has no _key", () => {
  assert.deepEqual(extractStrings({ items: ["one", "two"] }), { "items[0]": "one", "items[1]": "two" });
});

test("a prefix makes keys relative to a sub-tree", () => {
  assert.deepEqual(extractStrings({ label: "Hi" }, "hero"), { "hero.label": "Hi" });
});

test("throws on rich text so a new Portable Text field fails loudly instead of being skipped", () => {
  assert.throws(
    () => extractStrings({ body: [{ _type: "block", children: [{ _type: "span", text: "x" }] }] }),
    /Portable Text/,
  );
});

test("applyTranslations replaces only keys present in the map and never mutates the input", () => {
  const before = JSON.stringify(home);
  const out = applyTranslations(home, { "hero.title": "Aprendamos juntos", "hero.avatars[a1].alt": "Escuela uno" });
  assert.equal(out.hero.title, "Aprendamos juntos");
  assert.equal(out.hero.avatars[0].alt, "Escuela uno");
  assert.equal(out.hero.label, "Habitat");
  assert.equal(out.hero.avatars[1].alt, "School two");
  assert.equal(JSON.stringify(home), before);
});

test("REVIEW: a missing or empty translation falls back to the English string", () => {
  const out = applyTranslations(home, { "hero.title": "", "hero.label": "   " });
  assert.equal(out.hero.title, "Learn together");
  assert.equal(out.hero.label, "Habitat");
});

test("applyTranslations with a prefix matches extractStrings with the same prefix", () => {
  const strings = extractStrings(home.hero, "hero");
  const translated = Object.fromEntries(Object.entries(strings).map(([k, v]) => [k, `[ar] ${v}`]));
  const out = applyTranslations(home.hero, translated, "hero");
  assert.equal(out.title, "[ar] Learn together");
  assert.equal(out.avatars[1].alt, "[ar] School two");
});

test("hashStrings is stable across key order and changes when any string changes", async () => {
  const a = await hashStrings({ x: "1", y: "2" });
  const b = await hashStrings({ y: "2", x: "1" });
  const c = await hashStrings({ x: "1", y: "3" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("REVIEW: parseStrings returns null for corrupt, blank or non-object JSON", () => {
  assert.equal(parseStrings("{not json"), null);
  assert.equal(parseStrings(""), null);
  assert.equal(parseStrings(null), null);
  assert.equal(parseStrings(undefined), null);
  assert.equal(parseStrings("[1,2]"), null);
  assert.equal(parseStrings("42"), null);
  assert.deepEqual(parseStrings('{"a":"b","c":5}'), { a: "b" });
});

test("ids", () => {
  assert.equal(translationId("ar", "homePage-en"), "translation-ar-homePage-en");
  assert.equal(storeKey("zh-cn", "post-1"), "zh-cn__post-1");
});
```

- [ ] **Step 2: Run to see failure**

Run: `node --test lib/crowdin/extract.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** (`lib/crowdin/extract.ts`; must not import anything with the `@/` alias)

```ts
export type StringMap = Record<string, string>;

// Keys that hold logic, not copy.
const NON_TRANSLATABLE_KEYS = new Set(["language", "variant", "date", "url", "href"]);
// Whole sub-trees that are never translated (relative to the document root).
const NON_TRANSLATABLE_PATHS = new Set(["links", "languages"]);
const ABSOLUTE_URL = /^https?:\/\//i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function isTranslatable(key: string, value: string): boolean {
  if (NON_TRANSLATABLE_KEYS.has(key)) return false;
  if (value.trim() === "") return false;
  if (ABSOLUTE_URL.test(value)) return false;
  if (ISO_DATE.test(value)) return false;
  return true;
}

type Visit = (path: string, value: string) => string;

// One walker for both directions so extraction keys and merge keys can never drift apart.
function transform(node: unknown, path: string, key: string, visit: Visit, strict: boolean): unknown {
  if (typeof node === "string") return isTranslatable(key, node) ? visit(path, node) : node;

  if (Array.isArray(node)) {
    return node.map((item, index) => {
      const itemKey =
        item && typeof item === "object" && typeof (item as { _key?: unknown })._key === "string"
          ? (item as { _key: string })._key
          : String(index);
      return transform(item, `${path}[${itemKey}]`, key, visit, strict);
    });
  }

  if (node && typeof node === "object") {
    const object = node as Record<string, unknown>;
    if (strict && (object._type === "block" || object._type === "span")) {
      throw new Error(
        "Portable Text (rich text) is not supported by the translation extractor yet. Add support in lib/crowdin/extract.ts before adding such a field.",
      );
    }
    const out: Record<string, unknown> = {};
    for (const [childKey, value] of Object.entries(object)) {
      const childPath = path ? `${path}.${childKey}` : childKey;
      if (childKey.startsWith("_") || NON_TRANSLATABLE_PATHS.has(childPath)) {
        out[childKey] = value;
      } else {
        out[childKey] = transform(value, childPath, childKey, visit, strict);
      }
    }
    return out;
  }

  return node;
}

export function extractStrings(doc: unknown, prefix = ""): StringMap {
  const map: StringMap = {};
  transform(
    doc,
    prefix,
    "",
    (path, value) => {
      map[path] = value;
      return value;
    },
    true,
  );
  return map;
}

// Returns a copy of `data` with translated strings swapped in. Missing or blank translations keep English.
export function applyTranslations<T>(data: T, map: StringMap, prefix = ""): T {
  return transform(data, prefix, "", (path, value) => (map[path]?.trim() ? map[path] : value), false) as T;
}

export async function hashStrings(map: StringMap): Promise<string> {
  const entries = Object.keys(map)
    .sort()
    .map((key) => [key, map[key]]);
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A stored translation document must never be able to break a page: anything unexpected means "no translation".
export function parseStrings(json: unknown): StringMap | null {
  if (typeof json !== "string" || json === "") return null;
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const map: StringMap = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "string") map[key] = entry;
    }
    return map;
  } catch {
    return null;
  }
}
```

`lib/crowdin/ids.ts`:

```ts
// One Sanity document per language and source document. No dots: ids containing "." are private in Sanity.
export const translationId = (code: string, sourceId: string) => `translation-${code}-${sourceId}`;

// Key used inside translationStatus.stored to remember which hash of a source a language was stored for.
export const storeKey = (code: string, sourceId: string) => `${code}__${sourceId}`;
```

- [ ] **Step 4: Run and confirm PASS**

Run: `node --test lib/crowdin/extract.test.ts`
Expected: all tests pass. If the "skips ... by shape" test fails on `c` (ISO date with time), confirm the `ISO_DATE` regex matches the prefix only; it does.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint && git add lib/crowdin && git commit -m "feat: add translation string extractor, merge and hashing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Studio schema, seed script (Studio repo)

**Files (all in `../studio-habitat-learn-test`):**
- Create: `schemaTypes/shared/language-codes.ts`, `schemaTypes/objects/language-entry.ts`, `schemaTypes/documents/translation.ts`, `schemaTypes/documents/translation-status.ts`, `hidden-types.ts`, `scripts/seed-translations.ts`
- Modify: `schemaTypes/index.ts`, `schemaTypes/documents/site-settings.ts`, `sanity.config.ts`

**Interfaces:**
- Produces (documents/fields the site reads and writes):
  - `siteSettings-en.languages: {_key, code, nativeName, status: "off"|"preview"|"live"}[]`
  - `siteSettings-en.nav.languageMenu: string`
  - `translation` docs: `{_id: "translation-<code>-<sourceId>", language, source, hash, updatedAt, json}`
  - `translationStatus` singleton (`_id: "translationStatus"`): `requestedAt, running, runStartedAt, lastSyncAt, lastError, pendingCount, documents[{_key: sourceId, hash, fileId}], stored[{_key: "<code>__<sourceId>", hash, storedAt}]`

- [ ] **Step 1: Create the code list** (`schemaTypes/shared/language-codes.ts`)

```ts
// Keep in sync with LOCALES in the site repo (lib/locales.ts).
export const LANGUAGE_CODES = [
  'en', 'zh-cn', 'zh-tw', 'es', 'fr', 'de', 'ja', 'ko', 'pt-br',
  'it', 'ar', 'hi', 'nl', 'sv', 'da', 'nb', 'fi', 'ro',
]

export const LANGUAGE_STATUSES = [
  {title: 'Off (not translated, not visible)', value: 'off'},
  {title: 'Preview (reachable by URL, hidden from the switcher, not indexed)', value: 'preview'},
  {title: 'Live (in the language switcher, indexed by search engines)', value: 'live'},
]
```

- [ ] **Step 2: Create the language entry object** (`schemaTypes/objects/language-entry.ts`)

```ts
import {defineField, defineType} from 'sanity'
import {LANGUAGE_CODES, LANGUAGE_STATUSES} from '../shared/language-codes'

export const languageEntry = defineType({
  name: 'languageEntry',
  title: 'Language',
  type: 'object',
  fields: [
    defineField({
      name: 'code',
      title: 'Language code',
      type: 'string',
      options: {list: LANGUAGE_CODES},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'nativeName',
      title: 'Name in its own language (shown in the switcher)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {list: LANGUAGE_STATUSES, layout: 'radio'},
      initialValue: 'off',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {select: {title: 'nativeName', subtitle: 'status'}},
})
```

- [ ] **Step 2b: Create the two system documents**

`schemaTypes/documents/translation.ts`:

```ts
import {defineField, defineType} from 'sanity'

// Written by the site's Crowdin sync, never by hand (one per language and source document).
export const translation = defineType({
  name: 'translation',
  title: 'Translation',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({name: 'language', type: 'string'}),
    defineField({name: 'source', type: 'string'}),
    defineField({name: 'hash', type: 'string'}),
    defineField({name: 'updatedAt', type: 'datetime'}),
    defineField({name: 'json', type: 'text', rows: 10}),
  ],
  preview: {select: {title: 'source', subtitle: 'language'}},
})
```

`schemaTypes/documents/translation-status.ts`:

```ts
import {defineArrayMember, defineField, defineType} from 'sanity'

// Singleton (_id "translationStatus"). requestedAt is written by the Translations tool; the rest by the sync.
export const translationStatus = defineType({
  name: 'translationStatus',
  title: 'Translation status',
  type: 'document',
  fields: [
    defineField({name: 'requestedAt', type: 'datetime'}),
    defineField({name: 'running', type: 'boolean'}),
    defineField({name: 'runStartedAt', type: 'datetime'}),
    defineField({name: 'lastSyncAt', type: 'datetime'}),
    defineField({name: 'lastError', type: 'string'}),
    defineField({name: 'pendingCount', type: 'number'}),
    defineField({
      name: 'documents',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'syncedDocument',
          fields: [
            defineField({name: 'hash', type: 'string'}),
            defineField({name: 'fileId', type: 'number'}),
          ],
        }),
      ],
    }),
    defineField({
      name: 'stored',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'storedTranslation',
          fields: [
            defineField({name: 'hash', type: 'string'}),
            defineField({name: 'storedAt', type: 'datetime'}),
          ],
        }),
      ],
    }),
  ],
})
```

- [ ] **Step 3: Register the types** in `schemaTypes/index.ts`

Add imports `import {translation} from './documents/translation'`, `import {translationStatus} from './documents/translation-status'`, `import {languageEntry} from './objects/language-entry'` and add `translation, translationStatus, languageEntry` to the `schemaTypes` array.

- [ ] **Step 4: Add the languages field and menu label to `siteSettings`** (`schemaTypes/documents/site-settings.ts`)

- Add `defineArrayMember` to the `sanity` import: `import {defineArrayMember, defineField, defineType} from 'sanity'`.
- Add a group after the `links` group: `{name: 'languages', title: 'Languages'},`.
- In the `nav` object's fields, after `stringField('getStarted', 'Get started button'),` add:

```ts
        stringField('languageMenu', 'Language menu (screen reader label)'),
```

- After the `links` `objectField(...)` block (last item of `fields`), add:

```ts
    defineField({
      name: 'languages',
      title: 'Languages (set a language to Live to show it in the switcher)',
      type: 'array',
      group: 'languages',
      of: [defineArrayMember({type: 'languageEntry'})],
      validation: (rule) =>
        rule.required().min(1).custom((items?: {code?: string}[]) => {
          const codes = (items ?? []).map((item) => item.code)
          return new Set(codes).size === codes.length || 'Each language can appear only once'
        }),
    }),
```

- [ ] **Step 5: Hide system types from "New document"** 

`hidden-types.ts`:

```ts
// Written by the site's sync; editors never create these by hand.
export const HIDDEN_TYPES = ['translation', 'translationStatus']
```

In `sanity.config.ts` add `import {HIDDEN_TYPES} from './hidden-types'` and change the `newDocumentOptions` filter to:

```ts
        ? prev.filter(
            (item) => !SINGLETONS.includes(item.templateId) && !HIDDEN_TYPES.includes(item.templateId),
          )
```

- [ ] **Step 6: Seed script** (`scripts/seed-translations.ts`)

```ts
import {getCliClient} from 'sanity/cli'

// Run once: npx sanity exec scripts/seed-translations.ts --with-user-token
// Close any open draft of "Site settings" first: publishing an old draft would drop these fields.
const client = getCliClient({apiVersion: '2026-09-01'})

const NAMES: Record<string, string> = {
  en: 'English',
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ko: '한국어',
  'pt-br': 'Português (Brasil)',
  it: 'Italiano',
  ar: 'العربية',
  hi: 'हिन्दी',
  nl: 'Nederlands',
  sv: 'Svenska',
  da: 'Dansk',
  nb: 'Norsk bokmål',
  fi: 'Suomi',
  ro: 'Română',
}

async function main() {
  const languages = Object.entries(NAMES).map(([code, nativeName]) => ({
    _key: code,
    _type: 'languageEntry',
    code,
    nativeName,
    status: code === 'en' ? 'live' : 'off',
  }))

  await client
    .patch('siteSettings-en')
    .set({languages, 'nav.languageMenu': 'Language'})
    .commit()

  await client.createIfNotExists({
    _id: 'translationStatus',
    _type: 'translationStatus',
    running: false,
    pendingCount: 0,
  })

  console.log(`Seeded ${languages.length} languages and the translationStatus document.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 7: Type-check, build, seed**

```bash
cd ../studio-habitat-learn-test && npx tsc --noEmit && npm run build
```

Expected: no errors. Then (asks the user to confirm before writing to the production dataset):

```bash
npx sanity exec scripts/seed-translations.ts --with-user-token
```

Expected: `Seeded 18 languages and the translationStatus document.` Verify in the Studio (`npm run dev`, http://localhost:3333): Site settings has a "Languages" tab listing 18 entries with only English Live, and Navigation has a "Language menu" field.

- [ ] **Step 8: Commit (Studio repo)**

```bash
npx prettier --write schemaTypes hidden-types.ts scripts sanity.config.ts && git add -A && git commit -m "feat: languages, translation store and status schema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Language helpers, queries, localized fetch (site)

**Files:**
- Create: `lib/languages.ts`, `sanity/lib/localize.ts`, `sanity/lib/languages.ts`
- Test: `lib/languages.test.ts`
- Modify: `sanity/queries.ts`, `sanity/lib/fetch.ts`, `sanity/lib/site.ts`, `sanity.types.ts` (regenerated)

**Interfaces:**
- Consumes: `LOCALES`, `DEFAULT_LOCALE`, `getLocale` (Task 1); `applyTranslations`, `parseStrings`, `translationId` (Task 2).
- Produces:
  - `type LanguageStatus = "off" | "preview" | "live"`; `statusFor(rows, code): LanguageStatus` (default locale is always `"live"`); `liveLanguages(rows): {code, nativeName}[]` (in `LOCALES` order, requires a name); `activeLocales(rows): LocaleConfig[]` (non-default with status `preview` or `live`).
  - `SITE_LANGUAGES_QUERY`, `TRANSLATION_JSON_QUERY` (param `$id`).
  - `localize<T>(data: T, locale: string, sourceId: string, path?: string): Promise<T>`; `localizeDocs<T extends {_id: string}>(docs: T[], locale: string): Promise<T[]>`.
  - `fetchLocalized(query, locale, sourceId, path?)`.
  - `getSiteSettings(locale: string)` (now takes a locale).
  - `getLanguages()`, `requireAvailableLocale(code): Promise<{locale: LocaleConfig; status: LanguageStatus}>` (calls `notFound()` for `en`, unknown codes and `off`).

- [ ] **Step 1: Write failing tests** (`lib/languages.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { activeLocales, liveLanguages, statusFor } from "./languages.ts";

const rows = [
  { code: "en", nativeName: "English", status: "live" },
  { code: "ar", nativeName: "العربية", status: "live" },
  { code: "es", nativeName: "Español", status: "preview" },
  { code: "ja", nativeName: "日本語", status: "off" },
  { code: "fr", nativeName: "Français", status: "nonsense" },
];

test("English is always live, even with no rows", () => {
  assert.equal(statusFor(null, "en"), "live");
  assert.equal(statusFor(undefined, "en"), "live");
  assert.equal(statusFor([], "en"), "live");
});

test("REVIEW: unknown, missing and malformed statuses are off", () => {
  assert.equal(statusFor(rows, "ja"), "off");
  assert.equal(statusFor(rows, "fr"), "off");
  assert.equal(statusFor(rows, "de"), "off");
  assert.equal(statusFor(null, "ar"), "off");
  assert.equal(statusFor(rows, "xx"), "off");
});

test("live and preview are reported as such", () => {
  assert.equal(statusFor(rows, "ar"), "live");
  assert.equal(statusFor(rows, "es"), "preview");
});

test("liveLanguages lists only live languages in LOCALES order with their Sanity names", () => {
  assert.deepEqual(liveLanguages(rows), [
    { code: "en", nativeName: "English" },
    { code: "ar", nativeName: "العربية" },
  ]);
});

test("a live language without a name is left out rather than shown blank", () => {
  assert.deepEqual(liveLanguages([{ code: "en", nativeName: "English", status: "live" }, { code: "ar", status: "live" }]), [
    { code: "en", nativeName: "English" },
  ]);
});

test("activeLocales are the non-default preview and live locales", () => {
  assert.deepEqual(activeLocales(rows).map((l) => l.code), ["es", "ar"]);
});
```

- [ ] **Step 2: Run to fail**, `node --test lib/languages.test.ts` (module not found).

- [ ] **Step 3: Implement** (`lib/languages.ts`)

```ts
import { DEFAULT_LOCALE, LOCALES, type LocaleConfig } from "./locales.ts";

export type LanguageStatus = "off" | "preview" | "live";
export type LanguageRow = { code?: string | null; nativeName?: string | null; status?: string | null };
type Rows = readonly LanguageRow[] | null | undefined;

export function statusFor(rows: Rows, code: string): LanguageStatus {
  if (code === DEFAULT_LOCALE) return "live";
  const status = rows?.find((row) => row.code === code)?.status;
  return status === "live" || status === "preview" ? status : "off";
}

// Languages shown in the switcher: live, named, in the order of LOCALES.
export function liveLanguages(rows: Rows): { code: string; nativeName: string }[] {
  return LOCALES.flatMap((locale) => {
    if (statusFor(rows, locale.code) !== "live") return [];
    const nativeName = rows?.find((row) => row.code === locale.code)?.nativeName;
    return nativeName ? [{ code: locale.code, nativeName }] : [];
  });
}

// Languages Crowdin should translate into.
export function activeLocales(rows: Rows): LocaleConfig[] {
  return LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE && statusFor(rows, locale.code) !== "off");
}
```

- [ ] **Step 4: Run** `node --test lib/languages.test.ts`; expected PASS.

- [ ] **Step 5: Add queries** to `sanity/queries.ts`

```ts
export const SITE_LANGUAGES_QUERY = defineQuery(
  `*[_type == "siteSettings" && _id == "siteSettings-en"][0].languages`,
);

// A translation document holds the translated strings for one source document as a JSON string.
export const TRANSLATION_JSON_QUERY = defineQuery(
  `*[_type == "translation" && _id == $id][0].json`,
);
```

- [ ] **Step 6: `sanity/lib/localize.ts`**

```ts
import { cache } from "react";
import { applyTranslations, parseStrings, type StringMap } from "@/lib/crowdin/extract";
import { translationId } from "@/lib/crowdin/ids";
import { DEFAULT_LOCALE } from "@/lib/locales";
import { TRANSLATION_JSON_QUERY } from "@/sanity/queries";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { sanityFetch } from "./live";

const getStrings = cache(async (locale: string, sourceId: string): Promise<StringMap | null> => {
  const { data } = await sanityFetch({
    query: TRANSLATION_JSON_QUERY,
    params: { id: translationId(locale, sourceId) },
    tags: [SANITY_CACHE_TAG],
    stega: false,
  });
  return parseStrings(data);
});

// Swap translated strings into English data. English (or a missing/corrupt translation) is returned untouched.
export async function localize<T>(data: T, locale: string, sourceId: string, path = ""): Promise<T> {
  if (locale === DEFAULT_LOCALE) return data;
  const strings = await getStrings(locale, sourceId);
  return strings ? applyTranslations(data, strings, path) : data;
}

// For lists of documents (e.g. blog posts), each translated by its own _id.
export function localizeDocs<T extends { _id: string }>(docs: T[], locale: string): Promise<T[]> {
  return Promise.all(docs.map((doc) => localize(doc, locale, doc._id)));
}
```

- [ ] **Step 7: `fetchLocalized`** in `sanity/lib/fetch.ts`; add the import and function:

```ts
import { localize } from "./localize";

// English content from Sanity with translations for `locale` merged in. `path` is where the queried
// sub-tree sits inside the source document (e.g. "hero"), so keys line up with the extractor's.
export async function fetchLocalized<const Query extends string>(
  query: Query,
  locale: string,
  sourceId: string,
  path = "",
) {
  return localize(await fetchRequired(query), locale, sourceId, path);
}
```

- [ ] **Step 8: `getSiteSettings` takes a locale** (`sanity/lib/site.ts`); replace its definition:

```ts
import { fetchLocalized, fetchRequired } from "./fetch";
// ...
export const getSiteSettings = cache((locale: string) =>
  fetchLocalized(SITE_SETTINGS_QUERY, locale, "siteSettings-en"),
);
```

Leave `getLinks` unchanged (URLs are the same in every language).

- [ ] **Step 9: `sanity/lib/languages.ts`**

```ts
import { cache } from "react";
import { notFound } from "next/navigation";
import { stegaClean } from "next-sanity";
import { statusFor, type LanguageStatus } from "@/lib/languages";
import { DEFAULT_LOCALE, getLocale, type LocaleConfig } from "@/lib/locales";
import { SITE_LANGUAGES_QUERY } from "@/sanity/queries";
import { fetchRequired } from "./fetch";

export const getLanguages = cache(async () => {
  const rows = await fetchRequired(SITE_LANGUAGES_QUERY);
  // Codes and statuses drive logic, so strip stega. Names are visible text and stay as they are.
  return rows.map((row) => ({ ...row, code: stegaClean(row.code), status: stegaClean(row.status) }));
});

// 404 for "/en" (English lives at "/"), unknown codes, and languages that are off.
export async function requireAvailableLocale(
  code: string,
): Promise<{ locale: LocaleConfig; status: LanguageStatus }> {
  const locale = getLocale(code);
  if (!locale || code === DEFAULT_LOCALE) notFound();
  const status = statusFor(await getLanguages(), code);
  if (status === "off") notFound();
  return { locale, status };
}
```

- [ ] **Step 10: Regenerate types and verify**

```bash
npm run typegen && npx tsc --noEmit
```

Expected: `sanity.types.ts` gains `SiteLanguagesQueryResult` and `TranslationJsonQueryResult` and the `languages` and `languageMenu` fields; `tsc` fails only where `getSiteSettings()` is now called without a locale (Nav and Footer). Those are fixed in Task 6; if you prefer a green tree at every commit, do Step 11 first.

- [ ] **Step 11: Keep the tree compiling.** In `components/layout/Nav.tsx` and `Footer.tsx` temporarily call `getSiteSettings("en")`; Task 6 replaces this with the real locale. Then run `npm test && npx tsc --noEmit && npm run lint`.

- [ ] **Step 12: Commit**

```bash
npm run format && git add -A && git commit -m "feat: language helpers, translation queries and localized fetch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Two root layouts, English still identical

**Files:**
- Create: `app/fonts.ts`, `components/layout/SiteShell.tsx`, `sanity/lib/build-metadata.ts`, `app/(en)/layout.tsx`, `app/(en)/page.tsx`
- Delete: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: `getLocale` (Task 1), `localize` (Task 4).
- Produces: `SiteShell({ locale, children })` renders `<html lang dir>` + Nav + main + Footer + SanityLive (+ Draft Mode UI); `buildMetadata(locale): Promise<Metadata>`.

- [ ] **Step 1: Move the fonts** to `app/fonts.ts` (unchanged options)

```ts
import { Manrope } from "next/font/google";
import localFont from "next/font/local";

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-manrope",
  display: "swap",
});

// PP Woodland (Pangram Pangram), licensed; only the Regular weight is used on the homepage.
export const woodland = localFont({
  src: "./fonts/PPWoodland-Regular.woff2",
  weight: "400",
  variable: "--font-woodland",
  display: "swap",
});
```

- [ ] **Step 2: Move metadata** to `sanity/lib/build-metadata.ts`, taken from the old `generateMetadata` (behavior unchanged for English; `localize` makes the title and description translatable):

```ts
import type { Metadata } from "next";
import type { SanityImageSource } from "@sanity/image-url";
import { SANITY_CACHE_TAG } from "@/sanity/lib/cache-tag";
import { urlFor } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";
import { localize } from "@/sanity/lib/localize";
import { SITE_META_QUERY } from "@/sanity/queries";

export async function buildMetadata(locale: string): Promise<Metadata> {
  // stega must be off here: invisible characters must never reach <head>.
  const { data } = await sanityFetch({ query: SITE_META_QUERY, stega: false, tags: [SANITY_CACHE_TAG] });
  if (!data) throw new Error("No siteSettings meta found. Create the document in the Studio.");
  const meta = await localize(data, locale, "siteSettings-en", "meta");
  // Skip the image if an editor cleared the asset (urlFor throws on an asset-less image).
  const ogImage = meta.ogImage?.asset ? [urlFor(meta.ogImage as SanityImageSource).url()] : undefined;

  return {
    // Vercel exposes the production domain; fall back to localhost in dev.
    metadataBase: new URL(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000",
    ),
    title: meta.title,
    description: meta.description,
    openGraph: { type: "website", title: meta.title, description: meta.description, images: ogImage },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: ogImage },
  };
}
```

- [ ] **Step 3: `components/layout/SiteShell.tsx`** (the old `RootLayout` body, with locale)

```tsx
import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { revalidateSanityTags } from "@/app/actions/revalidate-sanity";
import { manrope, woodland } from "@/app/fonts";
import DisableDraftMode from "@/components/ui/DisableDraftMode";
import { getLocale } from "@/lib/locales";
import { SanityLive } from "@/sanity/lib/live";
import Footer from "./Footer";
import Nav from "./Nav";

export default async function SiteShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const config = getLocale(locale);
  if (!config) throw new Error(`Unknown locale: ${locale}`);
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <html lang={config.htmlLang} dir={config.dir} className={`${manrope.variable} ${woodland.variable}`}>
      <body className="bg-paper font-body text-body text-brand-purple/88 antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
        <SanityLive action={revalidateSanityTags} />
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

(`Nav` and `Footer` get their `locale` prop in Task 6.)

- [ ] **Step 4: English route group**

`app/(en)/layout.tsx`:

```tsx
import type { Metadata } from "next";
import SiteShell from "@/components/layout/SiteShell";
import { buildMetadata } from "@/sanity/lib/build-metadata";
import "../globals.css";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("en");
}

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell locale="en">{children}</SiteShell>;
}
```

`app/(en)/page.tsx` (the old `app/page.tsx` content, moved verbatim):

```tsx
import Blog from "@/components/home/Blog";
import Contact from "@/components/home/Contact";
import Hero from "@/components/home/Hero";
import Products from "@/components/home/Products";
import Values from "@/components/home/Values";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Values />
      <Products />
      <Blog />
      <Contact />
    </>
  );
}
```

- [ ] **Step 5: Remove the old files**

```bash
git rm app/layout.tsx app/page.tsx
```

- [ ] **Step 6: Build and compare pixels**

```bash
npm run build && npm run lint
```

Expected: build lists `/` as a route with no errors. Restart the server on port 3100 (`lsof -ti:3100 | xargs kill; npx next start -p 3100 &`), then:

```bash
node scripts/visual/check.mjs capture after http://localhost:3100 && node scripts/visual/check.mjs compare before after
```

Expected: exit code 0, no differences beyond tolerance.

- [ ] **Step 7: Commit**

```bash
npm run format && git add -A && git commit -m "refactor: split root layout into a shared SiteShell and an (en) route group

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Thread the locale through the page; add `/[locale]`

**Files:**
- Create: `components/home/HomePage.tsx`, `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`
- Modify: `components/home/{Hero,Values,Products,Blog,Contact}.tsx`, `components/layout/{Nav,Footer}.tsx`, `components/layout/SiteShell.tsx`, `app/(en)/page.tsx`, `lib/format-post-date.ts`
- Test: `lib/format-post-date.test.ts` (extend)

**Interfaces:**
- Consumes: `fetchLocalized`, `localizeDocs`, `getSiteSettings(locale)`, `requireAvailableLocale`, `getLanguages`, `statusFor`, `NON_DEFAULT_LOCALES`, `getLocale`.
- Produces: every section and `Nav`/`Footer` accept `{ locale: string }`; `HomePage({ locale })`; `formatPostDate(date, lang = "en-US")`.

- [ ] **Step 1: Extend the date test** (append to `lib/format-post-date.test.ts`)

```ts
test("formats in the requested language and keeps English as the default", () => {
  assert.equal(formatPostDate("2026-08-01", "en-US"), "Aug 2026");
  const japanese = formatPostDate("2026-08-01", "ja");
  assert.notEqual(japanese, "Aug 2026");
  assert.ok(japanese.includes("2026"));
});
```

Run `node --test lib/format-post-date.test.ts`; the new test fails because the second argument is ignored.

- [ ] **Step 2: Implement** (`lib/format-post-date.ts`, whole file)

```ts
// Blog cards show month and year only ("Aug 2026"). Pinned to UTC so the month never
// shifts with the reader's or the server's time zone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(lang: string): Intl.DateTimeFormat {
  let formatter = formatters.get(lang);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" });
    formatters.set(lang, formatter);
  }
  return formatter;
}

// A draft post in Presentation can have no date yet; render nothing instead of throwing.
export function formatPostDate(date: string | null | undefined, lang = "en-US"): string {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : formatterFor(lang).format(parsed);
}
```

Run the test file; expected PASS.

- [ ] **Step 3: Sections take a locale.** In each file change the function signature to `export default async function <Name>({ locale }: { locale: string })`, replace the `fetchRequired` import with `fetchLocalized`, and the fetch as below. Keep every JSX line as is.

| File | Old fetch | New fetch |
| --- | --- | --- |
| `Hero.tsx` | `fetchRequired(HOME_HERO_QUERY)` | `fetchLocalized(HOME_HERO_QUERY, locale, "homePage-en", "hero")` |
| `Values.tsx` | `fetchRequired(HOME_VALUES_QUERY)` | `fetchLocalized(HOME_VALUES_QUERY, locale, "homePage-en", "values")` |
| `Products.tsx` | `fetchRequired(HOME_PRODUCTS_QUERY)` | `fetchLocalized(HOME_PRODUCTS_QUERY, locale, "homePage-en", "products")` |
| `Contact.tsx` | `fetchRequired(HOME_CONTACT_QUERY)` | `fetchLocalized(HOME_CONTACT_QUERY, locale, "homePage-en", "contact")` |

`Blog.tsx` (blog copy plus the three posts, and a localized date):

```tsx
import { getLocale } from "@/lib/locales";
import { fetchLocalized, fetchRequired } from "@/sanity/lib/fetch";
import { localizeDocs } from "@/sanity/lib/localize";
// ...
export default async function Blog({ locale }: { locale: string }) {
  const [blog, rawPosts, links] = await Promise.all([
    fetchLocalized(HOME_BLOG_QUERY, locale, "homePage-en", "blog"),
    fetchRequired(HOME_POSTS_QUERY),
    getLinks(),
  ]);
  const posts = await localizeDocs(rawPosts, locale);
  const lang = getLocale(locale)?.htmlLang;
```

and change the date line to `formatPostDate(stegaClean(post.date), lang)`.

- [ ] **Step 4: Nav and Footer take a locale.** Signature `({ locale }: { locale: string })` and `const settings = await getSiteSettings(locale);` (removing the temporary `"en"` from Task 4).

- [ ] **Step 5: `SiteShell` passes it down:** `<Nav locale={locale} />` and `<Footer locale={locale} />`.

- [ ] **Step 6: One homepage assembly** (`components/home/HomePage.tsx`)

```tsx
import Blog from "./Blog";
import Contact from "./Contact";
import Hero from "./Hero";
import Products from "./Products";
import Values from "./Values";

export default function HomePage({ locale }: { locale: string }) {
  return (
    <>
      <Hero locale={locale} />
      <Values locale={locale} />
      <Products locale={locale} />
      <Blog locale={locale} />
      <Contact locale={locale} />
    </>
  );
}
```

`app/(en)/page.tsx` becomes:

```tsx
import HomePage from "@/components/home/HomePage";

export default function EnglishHomePage() {
  return <HomePage locale="en" />;
}
```

- [ ] **Step 7: The locale route group**

`app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import SiteShell from "@/components/layout/SiteShell";
import { statusFor } from "@/lib/languages";
import { NON_DEFAULT_LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/sanity/lib/build-metadata";
import { getLanguages, requireAvailableLocale } from "@/sanity/lib/languages";
import "../globals.css";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

// Pre-render the languages that are visible now; one switched on later renders on first request.
export async function generateStaticParams() {
  const rows = await getLanguages();
  return NON_DEFAULT_LOCALES.filter((locale) => statusFor(rows, locale.code) !== "off").map((locale) => ({
    locale: locale.code,
  }));
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return buildMetadata(locale);
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
```

`app/[locale]/page.tsx`:

```tsx
import HomePage from "@/components/home/HomePage";
import { requireAvailableLocale } from "@/sanity/lib/languages";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return <HomePage locale={locale} />;
}
```

- [ ] **Step 8: Verify**

```bash
npm run format && npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all green; build output lists `/` and `/[locale]`. Then start the server (port 3100) and check:

```bash
curl -s -o /dev/null -w "%{http_code} " localhost:3100/          # 200
curl -s -o /dev/null -w "%{http_code} " localhost:3100/en        # 404
curl -s -o /dev/null -w "%{http_code} " localhost:3100/xx        # 404
curl -s -o /dev/null -w "%{http_code}\n" localhost:3100/ar       # 404 (Arabic is off)
```

Expected: `200 404 404 404`. (This is Review Focus 3.) Then in the Studio set Arabic to **Preview**, wait for the publish webhook (about a minute on the deployed site; instantly on `npm run dev`), and `/ar` should return 200 with `<html lang="ar" dir="rtl">` and English text. Re-run the pixel comparison for `/`: `node scripts/visual/check.mjs capture after http://localhost:3100 && node scripts/visual/check.mjs compare before after` must exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: locale routing at /<lang> with translated sections, nav and footer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: hreflang, noindex for previews, sitemap

**Files:**
- Create: `lib/site-url.ts`, `app/sitemap.ts`
- Test: `lib/site-url.test.ts`
- Modify: `sanity/lib/build-metadata.ts`

**Interfaces:**
- Consumes: `LOCALES`, `localePath` (Task 1); `statusFor` (Task 4); `getLanguages` (Task 4).
- Produces: `resolveSiteUrl(env)`, `SITE_URL`; metadata gains `alternates` and `robots`.

- [ ] **Step 1: Failing test** (`lib/site-url.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSiteUrl } from "./site-url.ts";

test("prefers NEXT_PUBLIC_SITE_URL and trims trailing slashes", () => {
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://habitatlearn.com/" }), "https://habitatlearn.com");
});

test("falls back to the Vercel production domain, then localhost", () => {
  assert.equal(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }), "https://x.vercel.app");
  assert.equal(resolveSiteUrl({}), "http://localhost:3000");
});
```

- [ ] **Step 2: Implement** (`lib/site-url.ts`)

```ts
type Env = { NEXT_PUBLIC_SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string };

export function resolveSiteUrl(env: Env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// Literal process.env accesses so Next inlines NEXT_PUBLIC_* at build time.
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
```

Run `node --test lib/site-url.test.ts`; expected PASS.

- [ ] **Step 3: Use it in `build-metadata.ts`**: replace the `metadataBase` expression with `new URL(SITE_URL)`, import `SITE_URL`, and add alternates and robots:

```ts
import { statusFor } from "@/lib/languages";
import { LOCALES, DEFAULT_LOCALE, localePath } from "@/lib/locales";
import { SITE_URL } from "@/lib/site-url";
import { getLanguages } from "./languages";
// ... inside buildMetadata, after computing `meta` and `ogImage`:
  const rows = await getLanguages();
  const live = LOCALES.filter((entry) => statusFor(rows, entry.code) === "live");
  const alternates = {
    canonical: localePath(locale),
    languages: {
      "x-default": localePath(DEFAULT_LOCALE),
      ...Object.fromEntries(live.map((entry) => [entry.htmlLang, localePath(entry.code)])),
    },
  };
  // Machine-translated previews must not be indexed until someone flips them to Live.
  const robots = statusFor(rows, locale) === "preview" ? { index: false, follow: false } : undefined;
// ... in the returned object: metadataBase: new URL(SITE_URL), alternates, robots,
```

- [ ] **Step 4: Sitemap** (`app/sitemap.ts`)

```ts
import type { MetadataRoute } from "next";
import { statusFor } from "@/lib/languages";
import { LOCALES, localePath } from "@/lib/locales";
import { SITE_URL } from "@/lib/site-url";
import { getLanguages } from "@/sanity/lib/languages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await getLanguages();
  const live = LOCALES.filter((locale) => statusFor(rows, locale.code) === "live");
  const languages = Object.fromEntries(live.map((locale) => [locale.htmlLang, `${SITE_URL}${localePath(locale.code)}`]));
  return live.map((locale) => ({ url: `${SITE_URL}${localePath(locale.code)}`, alternates: { languages } }));
}
```

- [ ] **Step 5: Verify**

```bash
npm run format && npm test && npm run lint && npm run build
```

Run the server on 3100 and check `curl -s localhost:3100/sitemap.xml` lists only `/` (plus any live locale) and `curl -s localhost:3100/ar | grep -o '<meta name="robots"[^>]*>'` prints `noindex` while Arabic is Preview (needs the page from Task 6). Set `NEXT_PUBLIC_SITE_URL=http://localhost:3100` in `.env.local` for this check and remember to set the real origin before deploying.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: hreflang alternates, noindex for previews, sitemap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Language switcher

**Files:**
- Create: `components/layout/LanguageSwitcher.tsx`
- Modify: `components/layout/Nav.tsx`

**Interfaces:**
- Consumes: `liveLanguages` (Task 4), `getLanguages` (Task 4), `getLocale`, `localePath` (Task 1), `nav.languageMenu` (Task 3).
- Produces: `LanguageSwitcher({ locale, label, variant: "dropdown" | "list" })`; renders nothing when fewer than two languages are live.

- [ ] **Step 1: Component** (`components/layout/LanguageSwitcher.tsx`)

```tsx
import { liveLanguages } from "@/lib/languages";
import { getLocale, localePath } from "@/lib/locales";
import { getLanguages } from "@/sanity/lib/languages";

type Props = { locale: string; label: string; variant: "dropdown" | "list" };

export default async function LanguageSwitcher({ locale, label, variant }: Props) {
  const rows = await getLanguages();
  const languages = liveLanguages(rows);
  if (languages.length < 2) return null;

  const currentName = rows.find((row) => row.code === locale)?.nativeName ?? languages[0].nativeName;
  const items = languages.map((language) => ({
    ...language,
    href: localePath(language.code),
    lang: getLocale(language.code)?.htmlLang,
  }));

  if (variant === "list") {
    return (
      <nav aria-label={label} className="flex flex-col gap-3">
        <div className="h-px w-full bg-brand-purple/16" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {items.map((item) => (
            <li key={item.code}>
              <a
                href={item.href}
                hrefLang={item.lang}
                lang={item.lang}
                aria-current={item.code === locale ? "true" : undefined}
                className="block py-1 text-body text-brand-purple aria-[current=true]:font-medium"
              >
                {item.nativeName}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className="dd group/dd relative">
      <div
        tabIndex={0}
        role="button"
        aria-haspopup="true"
        aria-label={label}
        className="flex cursor-pointer items-center rounded-button border border-transparent px-3 py-2.5 text-[16px] font-medium leading-4 text-brand-purple transition-colors group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper group-focus-within/dd:border-paper/8 group-focus-within/dd:bg-brand-purple group-focus-within/dd:text-paper"
      >
        <span lang={getLocale(locale)?.htmlLang}>{currentName}</span>
      </div>
      <div className="invisible absolute end-0 top-full z-10 pt-2 opacity-0 transition-opacity duration-200 group-hover/dd:visible group-hover/dd:opacity-100 group-focus-within/dd:visible group-focus-within/dd:opacity-100">
        <ul className="grid max-h-[70vh] w-[340px] grid-cols-2 gap-1 overflow-y-auto rounded-panel bg-paper p-3 shadow-button">
          {items.map((item) => (
            <li key={item.code}>
              <a
                href={item.href}
                hrefLang={item.lang}
                lang={item.lang}
                aria-current={item.code === locale ? "true" : undefined}
                className="block rounded-button px-3 py-2 text-brand-purple/88 hover:bg-brand-purple hover:text-paper aria-[current=true]:font-medium"
              >
                {item.nativeName}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Place it in the nav** (`components/layout/Nav.tsx`)

Import: `import LanguageSwitcher from "./LanguageSwitcher";`.

Replace the desktop "Get started" button:

```tsx
          <Button href={links.apply} className="hidden lg:flex">
            {nav.getStarted}
          </Button>
```

with:

```tsx
          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher locale={locale} label={nav.languageMenu} variant="dropdown" />
            <Button href={links.apply}>{nav.getStarted}</Button>
          </div>
```

In the mobile menu panel, between the items `<div className="flex flex-col gap-3">...</div>` and the `<PromoTile className="h-[245px]" ...>`, add:

```tsx
            <LanguageSwitcher locale={locale} label={nav.languageMenu} variant="list" />
```

- [ ] **Step 3: Verify.** With Arabic and Spanish set to **Live** in the Studio (English already is): `npm run build`, start on 3100, and check at 1440px (dropdown appears left of the button, opens on hover/focus, two columns, scrolls if long), at 390px (list inside the mobile menu), and with only English live (no switcher renders, so the nav is pixel-identical to before: re-run `capture after` / `compare before after`). Confirm each link has `lang` and `hreflang`, and `aria-current="true"` marks the current language.

- [ ] **Step 4: Commit**

```bash
npm run format && npm run lint && npm run build && git add -A && git commit -m "feat: CSS-only language switcher in the nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Right-to-left sweep and the direction guard

**Files:**
- Create: `lib/direction-guard.ts`
- Test: `lib/direction-guard.test.ts`
- Modify: `components/ui/SectionHeader.tsx`, `components/ui/Button.tsx`, `components/ui/DisableDraftMode.tsx`, `components/ui/BackgroundVideo.tsx`, `components/home/Hero.tsx`, `components/home/Contact.tsx`, `components/layout/Nav.tsx`, plus any file the guard reports

**Interfaces:**
- Produces: `PHYSICAL_UTILITY: RegExp`; a repo-wide test that fails on physical direction utilities lacking an `rtl:`/`ltr:` variant on the same line.

- [ ] **Step 1: The guard and its test**

`lib/direction-guard.ts`:

```ts
// Tailwind utilities tied to left/right. In right-to-left languages they point the wrong way, so use the
// logical versions (ms/me/ps/pe/start/end, text-start/end) or put an rtl: variant on the same line.
export const PHYSICAL_UTILITY =
  /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-|text-(?:left|right)\b|border-[lr](?:-|\b)|rounded-(?:l|r|tl|tr|bl|br)(?:-|\b)|float-(?:left|right)\b|-?translate-x-|bg-gradient-to-(?:l|r|tl|tr|bl|br)\b|space-x-|divide-x)/;
```

`lib/direction-guard.test.ts`:

```ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PHYSICAL_UTILITY } from "./direction-guard.ts";

test("the pattern flags physical utilities and lets logical ones through", () => {
  for (const bad of ['className="ml-4"', "-mr-1", "md:pl-content", "left-0", "text-left", "border-l", "rounded-r-lg", "group-hover:translate-x-full", "bg-gradient-to-r"]) {
    assert.ok(PHYSICAL_UTILITY.test(bad), `should flag ${bad}`);
  }
  for (const ok of ['className="ms-4"', "-me-1", "lg:ps-content", "start-0", "text-start", "border-s", "rounded-e-lg", "pl", "primary-left"]) {
    assert.ok(!PHYSICAL_UTILITY.test(ok), `should allow ${ok}`);
  }
});

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

test("no physical direction utilities in components or app without an rtl:/ltr: variant on the line", () => {
  const offenders: string[] = [];
  for (const file of [...tsxFiles("components"), ...tsxFiles("app")]) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (PHYSICAL_UTILITY.test(line) && !/\b(?:rtl|ltr):/.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 110)}`);
        }
      });
  }
  assert.deepEqual(offenders, [], `Use logical utilities or add an rtl: variant:\n${offenders.join("\n")}`);
});
```

Add `lib/direction-guard.test.ts` to the glob (it matches `lib/*.test.ts`). Run `node --test lib/direction-guard.test.ts`. Expected: the pattern test passes; the repo test **fails** listing the offenders in the steps below.

- [ ] **Step 2: Fix every offender.** Apply these exact changes (the guard's list must end empty):

| File | Change |
| --- | --- |
| `SectionHeader.tsx`, `Hero.tsx`, `Contact.tsx`, `Nav.tsx` (two places) | `className="ml-[5px]"` -> `className="ms-[5px]"` |
| `Hero.tsx` avatars | `"-ml-4"` -> `"-ms-4"` |
| `Button.tsx` arrow wrapper | `-mr-1` -> `-me-1` |
| `Button.tsx` first `<ArrowIcon>` | `group-hover:translate-x-full` -> `group-hover:translate-x-full rtl:-scale-x-100 rtl:group-hover:-translate-x-full` |
| `Button.tsx` second `<ArrowIcon>` | `-translate-x-full` ... `group-hover:translate-x-0` -> add `rtl:translate-x-full rtl:-scale-x-100` |
| `DisableDraftMode.tsx`, `BackgroundVideo.tsx` | `right-4` -> `end-4` |
| `Contact.tsx` left fade | `left-0` -> `start-0`; keep `bg-gradient-to-r` and add `rtl:bg-gradient-to-l` |
| `Contact.tsx` right fade | `right-0` -> `end-0`; keep `bg-gradient-to-l` and add `rtl:bg-gradient-to-r` |
| `Contact.tsx` partner list | `pr-20` -> `pe-20` |
| `Contact.tsx` form column | `lg:pl-content` -> `lg:ps-content` |
| `Contact.tsx` marquee | `animate-marquee` -> `animate-marquee rtl:[animation-direction:reverse]` (the keyframes run `translateX(0)` to `-50%`; reversed, they run right, which is the seamless direction when the row starts at the right edge) |

Also mirror every right-pointing arrow icon: run `grep -rn "<ArrowIcon\|<ArrowLargeIcon" components` and add `rtl:-scale-x-100` to each usage that is not already covered (the Button arrows above are).

Re-run `node --test lib/direction-guard.test.ts` until the offender list is empty.

- [ ] **Step 3: Verify visually.** With Arabic on Preview or Live, `npm run build`, start on 3100, capture `/ar` at 1440 and 390 (`node scripts/visual/check.mjs capture rtl http://localhost:3100/ar` if the script accepts a path; otherwise open it in the browser). Check: nav mirrored, buttons' arrows point left and slide correctly, hero avatar overlap runs the other way, the partner marquee scrolls without a gap, dropdown panels align to the correct edge, no horizontal scrollbar. English `/` must still compare clean: `capture after` then `compare before after` (exit 0).

- [ ] **Step 4: Commit**

```bash
npm run format && npm test && npm run lint && npm run build && git add -A && git commit -m "feat: right-to-left support with logical utilities and a direction guard test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Crowdin REST port and info script

**Files:**
- Create: `lib/crowdin/port.ts`, `scripts/crowdin-info.mjs`
- Test: `lib/crowdin/port.test.ts`

**Interfaces:**
- Consumes: `StringMap` (Task 2).
- Produces:

```ts
export type CrowdinPort = {
  upsertFile(args: { name: string; content: string; fileId?: number }): Promise<number>;
  preTranslate(args: { fileIds: number[]; languageIds: string[] }): Promise<void>;
  getProgress(fileId: number): Promise<{ languageId: string; translationProgress: number }[]>;
  downloadTranslation(fileId: number, languageId: string): Promise<StringMap>;
};
export type CrowdinConfig = { token: string; projectId: number; baseUrl?: string; method: "tm" | "mt" | "ai"; engineId?: number; aiPromptId?: number; fetchImpl?: typeof fetch };
export function createCrowdinPort(config: CrowdinConfig): CrowdinPort;
```

The request shapes below come from the Crowdin REST API v2 as described by the official client's type definitions (`@crowdin/crowdin-api-client` 1.58) and are re-verified against the real API in Task 17.

- [ ] **Step 1: Failing tests** (`lib/crowdin/port.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createCrowdinPort } from "./port.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(routes: Record<string, unknown | ((call: Call) => unknown)>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    const key = `${call.method} ${url.replace("https://api.crowdin.com/api/v2", "").replace("https://cdn.example", "CDN")}`;
    const hit = Object.entries(routes).find(([pattern]) => key.startsWith(pattern));
    if (!hit) return new Response(`no route for ${key}`, { status: 500 });
    const value = typeof hit[1] === "function" ? (hit[1] as (c: Call) => unknown)(call) : hit[1];
    return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

const base = { token: "t0k", projectId: 7, method: "mt" as const, engineId: 3 };

test("creates a new file when none exists: storage upload, then file create", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 11 } },
    "GET /projects/7/files": { data: [{ data: { id: 5, name: "other.json" } }] },
    "POST /projects/7/files": { data: { id: 99 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  const id = await port.upsertFile({ name: "homePage-en.json", content: '{"a":"b"}' });
  assert.equal(id, 99);
  const storage = calls.find((c) => c.url.endsWith("/storages"))!;
  assert.equal(storage.headers["Crowdin-API-FileName"], "homePage-en.json");
  assert.equal(storage.headers.Authorization, "Bearer t0k");
  assert.equal(storage.body, '{"a":"b"}');
  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/projects/7/files"))!;
  assert.deepEqual(JSON.parse(create.body!), { storageId: 11, name: "homePage-en.json", type: "json" });
});

test("updates an existing file (known id) and clears translations of changed strings", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 12 } },
    "PUT /projects/7/files/99": { data: { id: 99 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  assert.equal(await port.upsertFile({ name: "homePage-en.json", content: "{}", fileId: 99 }), 99);
  const put = calls.find((c) => c.method === "PUT")!;
  assert.deepEqual(JSON.parse(put.body!), { storageId: 12, updateOption: "clear_translations_and_approvals" });
});

test("finds an existing file by name when the id is unknown, then updates it", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 13 } },
    "GET /projects/7/files": { data: [{ data: { id: 42, name: "homePage-en.json" } }] },
    "PUT /projects/7/files/42": { data: { id: 42 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  assert.equal(await port.upsertFile({ name: "homePage-en.json", content: "{}" }), 42);
  assert.ok(calls.some((c) => c.method === "PUT" && c.url.endsWith("/files/42")));
});

test("preTranslate sends the method, engine, languages and files", async () => {
  const { impl, calls } = fakeFetch({ "POST /projects/7/pre-translations": { data: { identifier: "x" } } });
  await createCrowdinPort({ ...base, fetchImpl: impl }).preTranslate({ fileIds: [1, 2], languageIds: ["ar", "es"] });
  assert.deepEqual(JSON.parse(calls[0].body!), {
    languageIds: ["ar", "es"],
    fileIds: [1, 2],
    method: "mt",
    engineId: 3,
    scope: "untranslated",
  });
});

test("getProgress flattens the per-language rows", async () => {
  const { impl } = fakeFetch({
    "GET /projects/7/files/99/languages/progress": {
      data: [{ data: { languageId: "ar", translationProgress: 100 } }, { data: { languageId: "es", translationProgress: 40 } }],
    },
  });
  assert.deepEqual(await createCrowdinPort({ ...base, fetchImpl: impl }).getProgress(99), [
    { languageId: "ar", translationProgress: 100 },
    { languageId: "es", translationProgress: 40 },
  ]);
});

test("downloadTranslation builds the file, fetches the URL and returns the string map", async () => {
  const { impl, calls } = fakeFetch({
    "POST /projects/7/translations/builds/files/99": { data: { url: "https://cdn.example/x.json" } },
    "GET CDN/x.json": { "hero.title": "Hola", ignored: 5 },
  });
  const map = await createCrowdinPort({ ...base, fetchImpl: impl }).downloadTranslation(99, "es");
  assert.deepEqual(map, { "hero.title": "Hola" });
  assert.deepEqual(JSON.parse(calls[0].body!), { targetLanguageId: "es" });
  assert.equal(calls[1].headers.Authorization, undefined, "the signed download URL must not get the API token");
});

test("downloadTranslation refuses nested JSON so an unexpected export shape is noticed", async () => {
  const { impl } = fakeFetch({
    "POST /projects/7/translations/builds/files/99": { data: { url: "https://cdn.example/x.json" } },
    "GET CDN/x.json": { hero: { title: "Hola" } },
  });
  await assert.rejects(createCrowdinPort({ ...base, fetchImpl: impl }).downloadTranslation(99, "es"), /nested/i);
});

test("a non-2xx response throws with the status and a body excerpt", async () => {
  const { impl } = fakeFetch({});
  await assert.rejects(
    createCrowdinPort({ ...base, fetchImpl: impl }).getProgress(1),
    /Crowdin GET .* failed: 500/,
  );
});
```

Run `node --test lib/crowdin/port.test.ts`; expected FAIL (module not found).

- [ ] **Step 2: Implement** (`lib/crowdin/port.ts`)

```ts
import type { StringMap } from "./extract.ts";

export type CrowdinPort = {
  upsertFile(args: { name: string; content: string; fileId?: number }): Promise<number>;
  preTranslate(args: { fileIds: number[]; languageIds: string[] }): Promise<void>;
  getProgress(fileId: number): Promise<{ languageId: string; translationProgress: number }[]>;
  downloadTranslation(fileId: number, languageId: string): Promise<StringMap>;
};

export type CrowdinConfig = {
  token: string;
  projectId: number;
  /** Crowdin Enterprise uses https://<org>.api.crowdin.com/api/v2 */
  baseUrl?: string;
  method: "tm" | "mt" | "ai";
  engineId?: number;
  aiPromptId?: number;
  fetchImpl?: typeof fetch;
};

export function createCrowdinPort(config: CrowdinConfig): CrowdinPort {
  const base = config.baseUrl ?? "https://api.crowdin.com/api/v2";
  const doFetch = config.fetchImpl ?? fetch;
  const project = `/projects/${config.projectId}`;

  async function call<T>(path: string, method: string, headers: Record<string, string> = {}, body?: string): Promise<T> {
    const response = await doFetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}`, ...headers },
      body,
    });
    if (!response.ok) {
      throw new Error(`Crowdin ${method} ${path} failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }

  const jsonHeaders = { "Content-Type": "application/json" };

  async function addStorage(name: string, content: string): Promise<number> {
    const result = await call<{ data: { id: number } }>(
      "/storages",
      "POST",
      { "Crowdin-API-FileName": name, "Content-Type": "application/octet-stream" },
      content,
    );
    return result.data.id;
  }

  async function findFileId(name: string): Promise<number | undefined> {
    const result = await call<{ data: { data: { id: number; name: string } }[] }>(`${project}/files?limit=500`, "GET");
    return result.data.find((entry) => entry.data.name === name)?.data.id;
  }

  return {
    async upsertFile({ name, content, fileId }) {
      const storageId = await addStorage(name, content);
      const existing = fileId ?? (await findFileId(name));
      if (existing !== undefined) {
        await call(
          `${project}/files/${existing}`,
          "PUT",
          jsonHeaders,
          // Changed strings lose their old translation (it would be wrong for the new sentence) and get re-translated;
          // unchanged strings keep theirs.
          JSON.stringify({ storageId, updateOption: "clear_translations_and_approvals" }),
        );
        return existing;
      }
      const created = await call<{ data: { id: number } }>(
        `${project}/files`,
        "POST",
        jsonHeaders,
        JSON.stringify({ storageId, name, type: "json" }),
      );
      return created.data.id;
    },

    async preTranslate({ fileIds, languageIds }) {
      await call(
        `${project}/pre-translations`,
        "POST",
        jsonHeaders,
        JSON.stringify({
          languageIds,
          fileIds,
          method: config.method,
          ...(config.engineId !== undefined ? { engineId: config.engineId } : {}),
          ...(config.aiPromptId !== undefined ? { aiPromptId: config.aiPromptId } : {}),
          scope: "untranslated",
        }),
      );
    },

    async getProgress(fileId) {
      const result = await call<{ data: { data: { languageId: string; translationProgress: number } }[] }>(
        `${project}/files/${fileId}/languages/progress?limit=100`,
        "GET",
      );
      return result.data.map((row) => ({
        languageId: row.data.languageId,
        translationProgress: row.data.translationProgress,
      }));
    },

    async downloadTranslation(fileId, languageId) {
      const build = await call<{ data: { url: string } }>(
        `${project}/translations/builds/files/${fileId}`,
        "POST",
        jsonHeaders,
        JSON.stringify({ targetLanguageId: languageId }),
      );
      // The download URL is pre-signed: no Authorization header.
      const response = await doFetch(build.data.url);
      if (!response.ok) throw new Error(`Crowdin download failed: ${response.status}`);
      const parsed = (await response.json()) as Record<string, unknown>;
      const map: StringMap = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === "object") {
          throw new Error(`Crowdin returned nested JSON for "${key}"; expected a flat key/value file`);
        }
        if (typeof value === "string") map[key] = value;
      }
      return map;
    },
  };
}
```

Run `node --test lib/crowdin/port.test.ts`; expected PASS.

- [ ] **Step 3: Info script** (`scripts/crowdin-info.mjs`). Lists the project's target languages and MT engines and flags mismatches with `lib/locales.ts` so we configure real ids.

```js
// node --env-file=.env.local scripts/crowdin-info.mjs
import { LOCALES } from "../lib/locales.ts";

const token = process.env.CROWDIN_API_TOKEN;
const projectId = process.env.CROWDIN_PROJECT_ID;
const base = process.env.CROWDIN_API_BASE ?? "https://api.crowdin.com/api/v2";
if (!token || !projectId) throw new Error("Set CROWDIN_API_TOKEN and CROWDIN_PROJECT_ID (use --env-file=.env.local)");

async function get(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) return { error: `${response.status} ${text.slice(0, 200)}` };
  return JSON.parse(text);
}

const project = await get(`/projects/${projectId}`);
if (project.error) throw new Error(`Cannot read the project: ${project.error}`);
const targets = project.data.targetLanguages.map((l) => ({ id: l.id, name: l.name }));
console.log("Source language:", project.data.sourceLanguageId);
console.log("Target languages in Crowdin:", targets.map((t) => `${t.id} (${t.name})`).join(", "));

const wanted = LOCALES.filter((l) => l.code !== "en").map((l) => l.crowdinId);
const have = new Set(targets.map((t) => t.id));
console.log("In lib/locales.ts but not in Crowdin:", wanted.filter((id) => !have.has(id)));
console.log("In Crowdin but not in lib/locales.ts:", targets.map((t) => t.id).filter((id) => !wanted.includes(id)));

const engines = await get("/mts?limit=100");
console.log("Machine translation engines (use an id for CROWDIN_MT_ENGINE_ID):");
console.log(engines.error ? `  (could not list: ${engines.error})` : engines.data.map((e) => `  ${e.data.id}  ${e.data.name ?? e.data.type}`).join("\n") || "  none configured: add one in Crowdin > Tools > Machine Translation");
```

- [ ] **Step 4: Commit**

```bash
npm run format && npm test && npm run lint && git add -A && git commit -m "feat: fetch-based Crowdin port and project info script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: The sync engine

**Files:**
- Create: `lib/crowdin/sync.ts`, `lib/crowdin/source-docs.ts`
- Test: `lib/crowdin/sync.test.ts`, `lib/crowdin/source-docs.test.ts`

**Interfaces:**
- Consumes: `extractStrings`, `hashStrings`, `StringMap` (Task 2); `storeKey` (Task 2); `CrowdinPort` (Task 10); `LocaleConfig` (Task 1).
- Produces:

```ts
export type SourceDoc = { id: string; doc: unknown };
export type SyncDocuments = Record<string, { hash: string; fileId: number }>;
export type SyncStatus = { rev: string; running: boolean; runStartedAt?: string; documents: SyncDocuments; stored: Record<string, string> };
export type SyncDeps = {
  now(): Date;
  readStatus(): Promise<SyncStatus>;
  tryStart(rev: string, startedAt: string): Promise<boolean>;
  saveDocuments(documents: SyncDocuments): Promise<void>;
  finish(update: { documents?: SyncDocuments; lastSyncAt?: string; pendingCount?: number; lastError: string | null }): Promise<void>;
  setPending(count: number): Promise<void>;
  markStored(key: string, hash: string, at: string): Promise<void>;
  loadSourceDocs(): Promise<SourceDoc[]>;
  activeLocales(): Promise<LocaleConfig[]>;
  crowdin: CrowdinPort;
  storeTranslation(input: { code: string; sourceId: string; hash: string; strings: StringMap; at: string }): Promise<void>;
  revalidate(): Promise<void>;
};
export type SyncResult = { skipped?: "already-running"; pushed: string[]; stored: string[] };
export function runSync(deps: SyncDeps): Promise<SyncResult>;
export type FileEventResult = { ignored?: "unknown-file" | "inactive-language" | "incomplete"; stored?: string };
export function handleFileEvent(deps: SyncDeps, event: { fileId: number; languageId: string }): Promise<FileEventResult>;
export function computePending(deps: Pick<SyncDeps, "readStatus" | "loadSourceDocs">): Promise<number>;
```

And in `source-docs.ts`: `SOURCE_IDS = ["homePage-en", "siteSettings-en"]` and `SOURCE_POSTS_QUERY` (must equal `HOME_POSTS_QUERY`'s GROQ).

- [ ] **Step 1: Source constants and their guard test**

`lib/crowdin/source-docs.ts`:

```ts
// Documents whose copy is translated. Blog posts are the same newest-three that the homepage shows.
export const SOURCE_IDS = ["homePage-en", "siteSettings-en"];

// Must stay identical to HOME_POSTS_QUERY in sanity/queries.ts (checked by source-docs.test.ts).
export const SOURCE_POSTS_QUERY = `*[_type == "post" && defined(date) && defined(url) && defined(image.asset)] | order(date desc)[0...3]`;
```

`lib/crowdin/source-docs.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SOURCE_POSTS_QUERY } from "./source-docs.ts";

test("SOURCE_POSTS_QUERY matches the query the homepage renders", () => {
  assert.ok(readFileSync("sanity/queries.ts", "utf8").includes(SOURCE_POSTS_QUERY));
});
```

- [ ] **Step 2: Write the sync tests** (`lib/crowdin/sync.test.ts`). Full fake deps first, then the cases.

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StringMap } from "./extract.ts";
import { extractStrings, hashStrings } from "./extract.ts";
import { storeKey } from "./ids.ts";
import type { CrowdinPort } from "./port.ts";
import { computePending, handleFileEvent, runSync, type SyncDeps, type SyncStatus } from "./sync.ts";
import { getLocale } from "../locales.ts";

const ar = getLocale("ar")!;
const es = getLocale("es")!;
const home = { _id: "homePage-en", hero: { title: "Learn together" } };
const settings = { _id: "siteSettings-en", meta: { title: "Habitat" } };

type Log = { name: string; args: unknown }[];

function harness(over: {
  status?: Partial<SyncStatus>;
  docs?: { id: string; doc: unknown }[];
  locales?: typeof ar[];
  progress?: Record<number, { languageId: string; translationProgress: number }[]>;
  tryStart?: boolean;
  failPreTranslate?: boolean;
  now?: string;
} = {}) {
  const log: Log = [];
  const record = (name: string) => (args: unknown) => log.push({ name, args });
  const status: SyncStatus = { rev: "r1", running: false, documents: {}, stored: {}, ...over.status };
  let nextFileId = 100;
  const crowdin: CrowdinPort = {
    async upsertFile(args) { record("upsertFile")(args); return args.fileId ?? nextFileId++; },
    async preTranslate(args) { record("preTranslate")(args); if (over.failPreTranslate) throw new Error("mt down"); },
    async getProgress(fileId) { return over.progress?.[fileId] ?? []; },
    async downloadTranslation(fileId, languageId) { record("download")({ fileId, languageId }); return { "hero.title": `[${languageId}]` } as StringMap; },
  };
  const deps: SyncDeps = {
    now: () => new Date(over.now ?? "2026-09-25T12:00:00Z"),
    readStatus: async () => status,
    tryStart: async (rev, startedAt) => { record("tryStart")({ rev, startedAt }); return over.tryStart ?? true; },
    saveDocuments: async (documents) => record("saveDocuments")(documents),
    finish: async (update) => record("finish")(update),
    setPending: async (count) => record("setPending")(count),
    markStored: async (key, hash) => record("markStored")({ key, hash }),
    loadSourceDocs: async () => over.docs ?? [{ id: "homePage-en", doc: home }, { id: "siteSettings-en", doc: settings }],
    activeLocales: async () => over.locales ?? [ar],
    crowdin,
    storeTranslation: async (input) => record("storeTranslation")({ code: input.code, sourceId: input.sourceId, hash: input.hash }),
    revalidate: async () => record("revalidate")(null),
  };
  return { deps, log, names: () => log.map((entry) => entry.name) };
}

const homeHash = () => hashStrings(extractStrings(home));

test("pushes every new document, pre-translates once for the active languages, saves documents first", async () => {
  const { deps, log, names } = harness({ locales: [ar, es] });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, ["homePage-en", "siteSettings-en"]);
  const upserts = log.filter((e) => e.name === "upsertFile").map((e) => e.args as { name: string; content: string });
  assert.deepEqual(upserts.map((u) => u.name), ["homePage-en.json", "siteSettings-en.json"]);
  assert.deepEqual(JSON.parse(upserts[0].content), { "hero.title": "Learn together" });
  const pre = log.find((e) => e.name === "preTranslate")!.args as { fileIds: number[]; languageIds: string[] };
  assert.deepEqual(pre.languageIds, ["ar", "es"]);
  assert.equal(pre.fileIds.length, 2);
  assert.ok(names().indexOf("saveDocuments") > -1);
  assert.ok(names().indexOf("saveDocuments") < names().indexOf("preTranslate"));
  assert.equal(names().filter((n) => n === "preTranslate").length, 1);
});

test("skips documents whose hash is unchanged and does not pre-translate when nothing changed", async () => {
  const { deps, names } = harness({
    status: { documents: { "homePage-en": { hash: await homeHash(), fileId: 7 }, "siteSettings-en": { hash: await hashStrings(extractStrings(settings)), fileId: 8 } } },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, []);
  assert.ok(!names().includes("upsertFile"));
  assert.ok(!names().includes("preTranslate"));
});

test("only the changed document is re-pushed, reusing its Crowdin file id", async () => {
  const { deps, log } = harness({
    status: { documents: { "homePage-en": { hash: "old", fileId: 7 }, "siteSettings-en": { hash: await hashStrings(extractStrings(settings)), fileId: 8 } } },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, ["homePage-en"]);
  assert.equal((log.find((e) => e.name === "upsertFile")!.args as { fileId?: number }).fileId, 7);
});

test("does not call pre-translation when no language is active", async () => {
  const { deps, names } = harness({ locales: [] });
  await runSync(deps);
  assert.ok(names().includes("upsertFile"));
  assert.ok(!names().includes("preTranslate"));
});

test("stores complete languages, skips incomplete ones, revalidates once, marks what it stored", async () => {
  const hash = await homeHash();
  const { deps, log } = harness({
    locales: [ar, es],
    status: { documents: { "homePage-en": { hash, fileId: 7 } } },
    docs: [{ id: "homePage-en", doc: home }],
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }, { languageId: "es", translationProgress: 60 }] },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.stored, [storeKey("ar", "homePage-en")]);
  assert.deepEqual(log.filter((e) => e.name === "download").map((e) => e.args), [{ fileId: 7, languageId: "ar" }]);
  assert.equal(log.filter((e) => e.name === "revalidate").length, 1);
  assert.deepEqual(log.find((e) => e.name === "markStored")!.args, { key: "ar__homePage-en", hash });
});

test("does not re-download a translation that is already stored for the current hash", async () => {
  const hash = await homeHash();
  const { deps, names } = harness({
    status: { documents: { "homePage-en": { hash, fileId: 7 } }, stored: { [storeKey("ar", "homePage-en")]: hash } },
    docs: [{ id: "homePage-en", doc: home }],
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }] },
  });
  await runSync(deps);
  assert.ok(!names().includes("download"));
  assert.ok(!names().includes("revalidate"));
});

test("REVIEW: a second press while a fresh run is in progress is a no-op", async () => {
  const { deps, names } = harness({ status: { running: true, runStartedAt: "2026-09-25T11:59:00Z" } });
  const result = await runSync(deps);
  assert.equal(result.skipped, "already-running");
  assert.deepEqual(names(), []);
});

test("a stale lock (older than 10 minutes) is taken over", async () => {
  const { deps, names } = harness({ status: { running: true, runStartedAt: "2026-09-25T11:00:00Z" } });
  const result = await runSync(deps);
  assert.equal(result.skipped, undefined);
  assert.ok(names().includes("tryStart"));
});

test("REVIEW: losing the optimistic lock race is a no-op", async () => {
  const { deps, names } = harness({ tryStart: false });
  const result = await runSync(deps);
  assert.equal(result.skipped, "already-running");
  assert.ok(!names().includes("upsertFile"));
});

test("REVIEW: a Crowdin failure records the error, clears running, and reverts documents so the next press retries", async () => {
  const previous = { "homePage-en": { hash: "old", fileId: 7 } };
  const { deps, log } = harness({ status: { documents: previous }, failPreTranslate: true });
  await assert.rejects(runSync(deps), /mt down/);
  const finish = log.filter((e) => e.name === "finish").pop()!.args as { documents?: unknown; lastError: string | null };
  assert.equal(finish.lastError, "mt down");
  assert.deepEqual(finish.documents, previous);
  assert.ok(!log.some((e) => e.name === "storeTranslation"), "no translations are replaced on failure");
});

test("a successful run clears the error and the pending count", async () => {
  const { deps, log } = harness();
  await runSync(deps);
  const finish = log.filter((e) => e.name === "finish").pop()!.args as { lastError: string | null; pendingCount?: number };
  assert.equal(finish.lastError, null);
  assert.equal(finish.pendingCount, 0);
});

test("REVIEW: webhook events for unknown files, inactive languages and incomplete files are ignored, not errors", async () => {
  const hash = await homeHash();
  const known = { status: { documents: { "homePage-en": { hash, fileId: 7 } } } };
  assert.deepEqual(await handleFileEvent(harness(known).deps, { fileId: 999, languageId: "ar" }), { ignored: "unknown-file" });
  assert.deepEqual(await handleFileEvent(harness({ ...known, locales: [es] }).deps, { fileId: 7, languageId: "ar" }), { ignored: "inactive-language" });
  const incomplete = harness({ ...known, progress: { 7: [{ languageId: "ar", translationProgress: 80 }] } });
  assert.deepEqual(await handleFileEvent(incomplete.deps, { fileId: 7, languageId: "ar" }), { ignored: "incomplete" });
  assert.ok(!incomplete.names().includes("storeTranslation"));
});

test("a complete file event stores the translation, marks it, and revalidates", async () => {
  const hash = await homeHash();
  const { deps, names, log } = harness({
    status: { documents: { "homePage-en": { hash, fileId: 7 } } },
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }] },
  });
  assert.deepEqual(await handleFileEvent(deps, { fileId: 7, languageId: "ar" }), { stored: "ar__homePage-en" });
  assert.deepEqual(names().filter((n) => ["download", "storeTranslation", "markStored", "revalidate"].includes(n)), ["download", "storeTranslation", "markStored", "revalidate"]);
  assert.deepEqual(log.find((e) => e.name === "storeTranslation")!.args, { code: "ar", sourceId: "homePage-en", hash });
});

test("computePending counts documents whose hash differs from the last push (or never pushed)", async () => {
  const { deps } = harness({
    status: { documents: { "homePage-en": { hash: await homeHash(), fileId: 7 }, "siteSettings-en": { hash: "stale", fileId: 8 } } },
  });
  assert.equal(await computePending(deps), 1);
  const fresh = harness();
  assert.equal(await computePending(fresh.deps), 2);
});
```

Run `node --test lib/crowdin/sync.test.ts lib/crowdin/source-docs.test.ts`; expected FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/crowdin/sync.ts`)

```ts
import type { LocaleConfig } from "../locales.ts";
import { extractStrings, hashStrings, type StringMap } from "./extract.ts";
import { storeKey } from "./ids.ts";
import type { CrowdinPort } from "./port.ts";

export type SourceDoc = { id: string; doc: unknown };
export type SyncDocuments = Record<string, { hash: string; fileId: number }>;
export type SyncStatus = {
  rev: string;
  running: boolean;
  runStartedAt?: string;
  documents: SyncDocuments;
  /** storeKey(code, sourceId) -> the source hash the stored translation was built for */
  stored: Record<string, string>;
};

export type SyncDeps = {
  now(): Date;
  readStatus(): Promise<SyncStatus>;
  /** Optimistic lock on the status document: false if someone else changed it first. */
  tryStart(rev: string, startedAt: string): Promise<boolean>;
  saveDocuments(documents: SyncDocuments): Promise<void>;
  finish(update: {
    documents?: SyncDocuments;
    lastSyncAt?: string;
    pendingCount?: number;
    lastError: string | null;
  }): Promise<void>;
  setPending(count: number): Promise<void>;
  markStored(key: string, hash: string, at: string): Promise<void>;
  loadSourceDocs(): Promise<SourceDoc[]>;
  activeLocales(): Promise<LocaleConfig[]>;
  crowdin: CrowdinPort;
  storeTranslation(input: { code: string; sourceId: string; hash: string; strings: StringMap; at: string }): Promise<void>;
  revalidate(): Promise<void>;
};

export type SyncResult = { skipped?: "already-running"; pushed: string[]; stored: string[] };

const STALE_LOCK_MS = 10 * 60 * 1000;

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const status = await deps.readStatus();
  const startedMs = status.runStartedAt ? Date.parse(status.runStartedAt) : 0;
  const lockIsFresh = status.running && deps.now().getTime() - startedMs < STALE_LOCK_MS;
  if (lockIsFresh || !(await deps.tryStart(status.rev, deps.now().toISOString()))) {
    return { skipped: "already-running", pushed: [], stored: [] };
  }

  const pushed: string[] = [];
  const storedKeys: string[] = [];
  try {
    const [sources, locales] = await Promise.all([deps.loadSourceDocs(), deps.activeLocales()]);

    // 1. Push changed documents.
    const documents: SyncDocuments = { ...status.documents };
    const changedFileIds: number[] = [];
    for (const { id, doc } of sources) {
      const strings = extractStrings(doc);
      const hash = await hashStrings(strings);
      const previous = documents[id];
      if (previous?.hash === hash) continue;
      const fileId = await deps.crowdin.upsertFile({
        name: `${id}.json`,
        content: JSON.stringify(strings, null, 2),
        fileId: previous?.fileId,
      });
      documents[id] = { hash, fileId };
      pushed.push(id);
      changedFileIds.push(fileId);
    }

    // 2. Record the file ids before translation starts, so a Crowdin webhook that fires soon after can find them.
    if (pushed.length > 0) await deps.saveDocuments(documents);

    // 3. Machine-translate the changed files for the languages that are switched on.
    if (changedFileIds.length > 0 && locales.length > 0) {
      await deps.crowdin.preTranslate({ fileIds: changedFileIds, languageIds: locales.map((l) => l.crowdinId) });
    }

    // 4. Pull whatever is already complete and not yet stored for the current hash.
    for (const [sourceId, { hash, fileId }] of Object.entries(documents)) {
      if (locales.every((l) => status.stored[storeKey(l.code, sourceId)] === hash)) continue;
      const progress = await deps.crowdin.getProgress(fileId);
      for (const locale of locales) {
        const key = storeKey(locale.code, sourceId);
        if (status.stored[key] === hash) continue;
        const row = progress.find((entry) => entry.languageId === locale.crowdinId);
        if (!row || row.translationProgress < 100) continue;
        const strings = await deps.crowdin.downloadTranslation(fileId, locale.crowdinId);
        const at = deps.now().toISOString();
        await deps.storeTranslation({ code: locale.code, sourceId, hash, strings, at });
        await deps.markStored(key, hash, at);
        storedKeys.push(key);
      }
    }

    if (storedKeys.length > 0) await deps.revalidate();
    await deps.finish({ documents, lastSyncAt: deps.now().toISOString(), pendingCount: 0, lastError: null });
    return { pushed, stored: storedKeys };
  } catch (error) {
    // Revert to the previous documents so the next press pushes and pre-translates again; the site keeps
    // serving whatever translations were already stored.
    await deps.finish({
      documents: status.documents,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type FileEventResult = {
  ignored?: "unknown-file" | "inactive-language" | "incomplete";
  stored?: string;
};

// Crowdin says a file is translated (or approved) for a language: pull it if it is really complete.
export async function handleFileEvent(
  deps: SyncDeps,
  event: { fileId: number; languageId: string },
): Promise<FileEventResult> {
  const status = await deps.readStatus();
  const entry = Object.entries(status.documents).find(([, doc]) => doc.fileId === event.fileId);
  if (!entry) return { ignored: "unknown-file" };
  const locale = (await deps.activeLocales()).find((candidate) => candidate.crowdinId === event.languageId);
  if (!locale) return { ignored: "inactive-language" };

  const [sourceId, { hash }] = entry;
  const progress = await deps.crowdin.getProgress(event.fileId);
  const row = progress.find((candidate) => candidate.languageId === event.languageId);
  if (!row || row.translationProgress < 100) return { ignored: "incomplete" };

  const strings = await deps.crowdin.downloadTranslation(event.fileId, event.languageId);
  const at = deps.now().toISOString();
  const key = storeKey(locale.code, sourceId);
  await deps.storeTranslation({ code: locale.code, sourceId, hash, strings, at });
  await deps.markStored(key, hash, at);
  await deps.revalidate();
  return { stored: key };
}

// How many source documents have changed since the last push (shown in the Studio next to the button).
export async function computePending(deps: Pick<SyncDeps, "readStatus" | "loadSourceDocs">): Promise<number> {
  const [status, sources] = await Promise.all([deps.readStatus(), deps.loadSourceDocs()]);
  let pending = 0;
  for (const { id, doc } of sources) {
    const hash = await hashStrings(extractStrings(doc));
    if (status.documents[id]?.hash !== hash) pending += 1;
  }
  return pending;
}
```

- [ ] **Step 4: Run and confirm PASS**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
npm run format && npm run lint && git add -A && git commit -m "feat: Crowdin sync engine with locking, hashing and completeness guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Sanity adapters and the sync and pending routes

**Files:**
- Create: `sanity/lib/write-client.ts`, `sanity/lib/webhook.ts`, `sanity/lib/crowdin-deps.ts`, `app/api/crowdin/sync/route.ts`, `app/api/crowdin/changed/route.ts`

**Interfaces:**
- Consumes: `SyncDeps` (Task 11), `createCrowdinPort` (Task 10), `translationId`, `storeKey` (Task 2), `activeLocales` (Task 4), `SOURCE_IDS`, `SOURCE_POSTS_QUERY` (Task 11), `SANITY_CACHE_TAG`.
- Produces: `createSyncDeps(): SyncDeps` (server only); `verifySanityWebhook(request, waitForContentLake): Promise<Response | null>`; POST `/api/crowdin/sync`, POST `/api/crowdin/changed`.

These files talk to live services, so they are exercised by the end-to-end check in Task 17; the logic they call is unit tested above. Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` before Step 4.

- [ ] **Step 1: Write client** (`sanity/lib/write-client.ts`)

```ts
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "@/sanity/env";

// Server only. The token is an Editor token stored as a Cloudflare secret, never sent to the browser.
export function getWriteClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) throw new Error("SANITY_API_WRITE_TOKEN is not set");
  return createClient({ projectId, dataset, apiVersion, token, useCdn: false, perspective: "published" });
}
```

- [ ] **Step 2: Webhook signature helper** (`sanity/lib/webhook.ts`)

```ts
import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

// Same mechanism as /api/revalidate. Returns a Response to send back if the request must be rejected, else null.
export async function verifySanityWebhook(
  request: NextRequest,
  waitForContentLakeEventualConsistency: boolean,
): Promise<Response | null> {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return new Response("SANITY_REVALIDATE_SECRET is not set", { status: 500 });
  const { isValidSignature } = await parseBody(request, secret, waitForContentLakeEventualConsistency);
  return isValidSignature ? null : new Response("Invalid signature", { status: 401 });
}
```

- [ ] **Step 3: Real `SyncDeps`** (`sanity/lib/crowdin-deps.ts`)

```ts
import { revalidateTag } from "next/cache";
import { translationId } from "@/lib/crowdin/ids";
import { createCrowdinPort } from "@/lib/crowdin/port";
import { SOURCE_IDS, SOURCE_POSTS_QUERY } from "@/lib/crowdin/source-docs";
import type { SyncDeps, SyncDocuments, SyncStatus } from "@/lib/crowdin/sync";
import { activeLocales } from "@/lib/languages";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { getWriteClient } from "./write-client";

const STATUS_ID = "translationStatus";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const optionalNumber = (value: string | undefined) => (value ? Number(value) : undefined);

type StatusDoc = {
  _rev: string;
  running?: boolean;
  runStartedAt?: string;
  documents?: { _key: string; hash?: string; fileId?: number }[];
  stored?: { _key: string; hash?: string }[];
};

const toArray = (documents: SyncDocuments) =>
  Object.entries(documents).map(([key, value]) => ({
    _key: key,
    _type: "syncedDocument",
    hash: value.hash,
    fileId: value.fileId,
  }));

export function createSyncDeps(): SyncDeps {
  const sanity = getWriteClient();
  const crowdin = createCrowdinPort({
    token: requireEnv("CROWDIN_API_TOKEN"),
    projectId: Number(requireEnv("CROWDIN_PROJECT_ID")),
    baseUrl: process.env.CROWDIN_API_BASE,
    method: (process.env.CROWDIN_PRETRANSLATE_METHOD ?? "mt") as "tm" | "mt" | "ai",
    engineId: optionalNumber(process.env.CROWDIN_MT_ENGINE_ID),
    aiPromptId: optionalNumber(process.env.CROWDIN_AI_PROMPT_ID),
  });

  return {
    now: () => new Date(),
    crowdin,

    async readStatus(): Promise<SyncStatus> {
      await sanity.createIfNotExists({ _id: STATUS_ID, _type: "translationStatus" });
      const doc = await sanity.fetch<StatusDoc>(`*[_id == $id][0]`, { id: STATUS_ID });
      const documents: SyncDocuments = {};
      for (const item of doc.documents ?? []) {
        if (item.hash && typeof item.fileId === "number") documents[item._key] = { hash: item.hash, fileId: item.fileId };
      }
      const stored: Record<string, string> = {};
      for (const item of doc.stored ?? []) if (item.hash) stored[item._key] = item.hash;
      return { rev: doc._rev, running: Boolean(doc.running), runStartedAt: doc.runStartedAt, documents, stored };
    },

    async tryStart(rev, startedAt) {
      try {
        await sanity.patch(STATUS_ID).ifRevisionId(rev).set({ running: true, runStartedAt: startedAt }).commit();
        return true;
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 409) return false;
        throw error;
      }
    },

    async saveDocuments(documents) {
      await sanity.patch(STATUS_ID).set({ documents: toArray(documents) }).commit();
    },

    async finish(update) {
      let patch = sanity.patch(STATUS_ID).set({ running: false });
      if (update.documents) patch = patch.set({ documents: toArray(update.documents) });
      if (update.lastSyncAt) patch = patch.set({ lastSyncAt: update.lastSyncAt });
      if (update.pendingCount !== undefined) patch = patch.set({ pendingCount: update.pendingCount });
      patch = update.lastError === null ? patch.unset(["lastError"]) : patch.set({ lastError: update.lastError });
      await patch.commit();
    },

    async setPending(count) {
      await sanity.createIfNotExists({ _id: STATUS_ID, _type: "translationStatus" });
      await sanity.patch(STATUS_ID).set({ pendingCount: count }).commit();
    },

    // One small transaction per (language, source): replace that entry without touching the others.
    async markStored(key, hash, at) {
      const selector = `stored[_key=="${key}"]`;
      await sanity
        .transaction()
        .patch(STATUS_ID, (p) => p.setIfMissing({ stored: [] }))
        .patch(STATUS_ID, (p) => p.unset([selector]))
        .patch(STATUS_ID, (p) =>
          p.insert("after", "stored[-1]", [{ _key: key, _type: "storedTranslation", hash, storedAt: at }]),
        )
        .commit();
    },

    async loadSourceDocs() {
      const [singletons, posts] = await Promise.all([
        sanity.fetch<Record<string, unknown>[]>(`*[_id in $ids]`, { ids: SOURCE_IDS }),
        sanity.fetch<Record<string, unknown>[]>(SOURCE_POSTS_QUERY),
      ]);
      return [...singletons, ...posts].map((doc) => ({ id: String(doc._id), doc }));
    },

    async activeLocales() {
      const rows = await sanity.fetch<{ code?: string; status?: string }[] | null>(
        `*[_id == "siteSettings-en"][0].languages`,
      );
      return activeLocales(rows);
    },

    async storeTranslation({ code, sourceId, hash, strings, at }) {
      await sanity.createOrReplace({
        _id: translationId(code, sourceId),
        _type: "translation",
        language: code,
        source: sourceId,
        hash,
        updatedAt: at,
        json: JSON.stringify(strings),
      });
    },

    async revalidate() {
      revalidateTag(SANITY_CACHE_TAG, { expire: 0 });
    },
  };
}
```

- [ ] **Step 4: Routes**

`app/api/crowdin/sync/route.ts`:

```ts
import { after, type NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/crowdin/sync";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";
import { verifySanityWebhook } from "@/sanity/lib/webhook";

// Called by a Sanity webhook when an editor presses "Translate all changes" in the Studio
// (translationStatus.requestedAt changed). Sanity only lets people who can write documents do that.
export async function POST(request: NextRequest) {
  const rejected = await verifySanityWebhook(request, false);
  if (rejected) return rejected;

  // Sanity gives webhooks about 30 seconds; the sync can take longer, so answer now and finish afterwards.
  after(async () => {
    try {
      console.log("crowdin sync", JSON.stringify(await runSync(createSyncDeps())));
    } catch (error) {
      console.error("crowdin sync failed", error);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
```

`app/api/crowdin/changed/route.ts`:

```ts
import { after, type NextRequest, NextResponse } from "next/server";
import { computePending } from "@/lib/crowdin/sync";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";
import { verifySanityWebhook } from "@/sanity/lib/webhook";

// Called by a Sanity webhook on publish of homePage, siteSettings or post: refreshes the "N documents changed"
// counter in the Studio. Does not talk to Crowdin.
export async function POST(request: NextRequest) {
  const rejected = await verifySanityWebhook(request, true);
  if (rejected) return rejected;

  after(async () => {
    try {
      const deps = createSyncDeps();
      await deps.setPending(await computePending(deps));
    } catch (error) {
      console.error("crowdin pending count failed", error);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
```

- [ ] **Step 5: Verify what can be verified locally**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: clean; the build lists `/api/crowdin/sync` and `/api/crowdin/changed`. Then reject-path checks against a running server (with `SANITY_REVALIDATE_SECRET` set):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3100/api/crowdin/sync -d '{}'
```

Expected: `401` (missing or invalid signature).

- [ ] **Step 6: Commit**

```bash
npm run format && git add -A && git commit -m "feat: Sanity adapters and sync/pending routes for Crowdin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Crowdin webhook route

**Files:**
- Create: `lib/crowdin/webhook.ts`, `app/api/crowdin/route.ts`
- Test: `lib/crowdin/webhook.test.ts`

**Interfaces:**
- Consumes: `handleFileEvent` (Task 11), `createSyncDeps` (Task 12).
- Produces: `isAuthorized(received, secret): boolean` (constant time); `parseFileEvents(body): { fileId: number; languageId: string }[]`; POST `/api/crowdin`.

Crowdin's project-webhook signing is not documented in what we found, but custom headers are, so the webhook is configured with a header `X-Webhook-Secret` carrying `CROWDIN_WEBHOOK_SECRET`.

- [ ] **Step 1: Failing tests** (`lib/crowdin/webhook.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthorized, parseFileEvents } from "./webhook.ts";

test("isAuthorized accepts only the exact secret", () => {
  assert.equal(isAuthorized("s3cret", "s3cret"), true);
  assert.equal(isAuthorized("s3cret!", "s3cret"), false);
  assert.equal(isAuthorized("wrong", "s3cret"), false);
});

test("REVIEW: a missing header or a missing server secret is never authorized", () => {
  assert.equal(isAuthorized(null, "s3cret"), false);
  assert.equal(isAuthorized(undefined, "s3cret"), false);
  assert.equal(isAuthorized("", ""), false);
  assert.equal(isAuthorized("x", undefined), false);
});

test("parses a single file.translated event", () => {
  assert.deepEqual(
    parseFileEvents({ event: "file.translated", file: { id: "44", project: { id: "7" } }, targetLanguage: { id: "es" } }),
    [{ fileId: 44, languageId: "es" }],
  );
});

test("parses file.approved and batched events, ignoring other events and malformed items", () => {
  const body = {
    events: [
      { event: "file.approved", file: { id: 5 }, targetLanguage: { id: "ar" } },
      { event: "project.translated", file: { id: 6 }, targetLanguage: { id: "ar" } },
      { event: "file.translated", file: { id: "nope" }, targetLanguage: { id: "ar" } },
      { event: "file.translated", file: { id: 8 } },
      null,
      "text",
    ],
  };
  assert.deepEqual(parseFileEvents(body), [{ fileId: 5, languageId: "ar" }]);
});

test("garbage bodies produce no events", () => {
  assert.deepEqual(parseFileEvents(null), []);
  assert.deepEqual(parseFileEvents("x"), []);
  assert.deepEqual(parseFileEvents({}), []);
});
```

Run `node --test lib/crowdin/webhook.test.ts`; expected FAIL.

- [ ] **Step 2: Implement** (`lib/crowdin/webhook.ts`)

```ts
import { timingSafeEqual } from "node:crypto";

export function isAuthorized(received: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type FileEvent = { fileId: number; languageId: string };

// Crowdin sends one event per request, or {events: [...]} when batching is on.
export function parseFileEvents(body: unknown): FileEvent[] {
  const batched = body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events);
  const items: unknown[] = batched ? (body as { events: unknown[] }).events : [body];
  const events: FileEvent[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const event = item as { event?: unknown; file?: { id?: unknown }; targetLanguage?: { id?: unknown } };
    if (event.event !== "file.translated" && event.event !== "file.approved") continue;
    const fileId = Number(event.file?.id);
    const languageId = event.targetLanguage?.id;
    if (!Number.isInteger(fileId) || typeof languageId !== "string") continue;
    events.push({ fileId, languageId });
  }
  return events;
}
```

- [ ] **Step 3: Route** (`app/api/crowdin/route.ts`)

```ts
import { after, type NextRequest, NextResponse } from "next/server";
import { handleFileEvent } from "@/lib/crowdin/sync";
import { isAuthorized, parseFileEvents } from "@/lib/crowdin/webhook";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";

// Crowdin project webhook (events: file.translated, file.approved). Authenticated with a custom header.
// Once authenticated this always answers 2xx, because Crowdin retries on errors; problems are logged instead.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request.headers.get("x-webhook-secret"), process.env.CROWDIN_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: 0 });
  }

  const events = parseFileEvents(body);
  after(async () => {
    const deps = createSyncDeps();
    for (const event of events) {
      try {
        console.log("crowdin event", JSON.stringify({ ...event, ...(await handleFileEvent(deps, event)) }));
      } catch (error) {
        console.error("crowdin event failed", event, error);
      }
    }
  });
  return NextResponse.json({ received: events.length });
}
```

- [ ] **Step 4: Verify**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Then against a running server with `CROWDIN_WEBHOOK_SECRET=abc` set: `curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3100/api/crowdin -d '{}'` prints `401`; the same with `-H "x-webhook-secret: abc"` prints `200`.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A && git commit -m "feat: Crowdin webhook route with secret header auth

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Studio "Translations" tool (Studio repo)

**Files (in `../studio-habitat-learn-test`):**
- Create: `tools/translations/TranslationsTool.tsx`, `tools/translations/index.ts`
- Modify: `sanity.config.ts`, `package.json` (`@sanity/ui`)

**Interfaces:**
- Consumes: `translationStatus` and `siteSettings-en.languages` documents (Task 3).
- Produces: a "Translations" tab with the **Translate all changes** button, the pending-changes counter and per-language progress. Pressing it writes `requestedAt` (which a Sanity webhook turns into a sync).

- [ ] **Step 1: Add the UI library at the version `sanity` already uses**

```bash
cd ../studio-habitat-learn-test && npm install @sanity/ui@"$(node -p "require('@sanity/ui/package.json').version")"
```

Expected: `@sanity/ui` added to `dependencies` with no second copy (`npm ls @sanity/ui` shows one version).

- [ ] **Step 2: The tool** (`tools/translations/TranslationsTool.tsx`)

```tsx
import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {useClient} from 'sanity'

type Status = {
  running?: boolean
  lastSyncAt?: string
  lastError?: string
  pendingCount?: number
  documents?: {_key: string}[]
  stored?: {_key: string}[]
} | null

type Language = {code: string; nativeName: string; status: 'off' | 'preview' | 'live'}

const API_VERSION = '2026-09-01'

export function TranslationsTool() {
  const client = useClient({apiVersion: API_VERSION})
  const [status, setStatus] = useState<Status>(null)
  const [languages, setLanguages] = useState<Language[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [nextStatus, nextLanguages] = await Promise.all([
        client.fetch<Status>('*[_id == "translationStatus"][0]'),
        client.fetch<Language[] | null>('*[_id == "siteSettings-en"][0].languages'),
      ])
      if (cancelled) return
      setStatus(nextStatus)
      setLanguages(nextLanguages ?? [])
    }
    load()
    const subscription = client
      .listen('*[_id in ["translationStatus", "siteSettings-en"]]', {}, {includeResult: false})
      .subscribe(() => load())
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [client])

  const translate = async () => {
    setBusy(true)
    try {
      await client.createIfNotExists({_id: 'translationStatus', _type: 'translationStatus'})
      await client.patch('translationStatus').set({requestedAt: new Date().toISOString()}).commit()
    } finally {
      setBusy(false)
    }
  }

  const pending = status?.pendingCount ?? 0
  const documentCount = status?.documents?.length ?? 0
  const running = Boolean(status?.running)

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Card padding={4} radius={2} shadow={1}>
          <Stack space={3}>
            <Text size={2} weight="semibold">
              {pending === 0
                ? 'All translations are up to date'
                : `${pending} document${pending === 1 ? '' : 's'} changed since the last translation`}
            </Text>
            <Text size={1} muted>
              {running
                ? 'Translating now. Languages appear on the site a few minutes after this finishes.'
                : status?.lastSyncAt
                  ? `Last sent to translation ${new Date(status.lastSyncAt).toLocaleString()}`
                  : 'Nothing has been sent for translation yet.'}
            </Text>
            {status?.lastError && (
              <Card padding={3} radius={2} tone="critical">
                <Text size={1}>Last attempt failed: {status.lastError}</Text>
              </Card>
            )}
            <Flex>
              <Button
                text="Translate all changes"
                tone="primary"
                disabled={busy || running}
                loading={busy || running}
                onClick={translate}
              />
            </Flex>
          </Stack>
        </Card>

        <Card padding={4} radius={2} shadow={1}>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              Languages
            </Text>
            {languages
              .filter((language) => language.code !== 'en')
              .map((language) => {
                const done = (status?.stored ?? []).filter((item) =>
                  item._key.startsWith(`${language.code}__`),
                ).length
                return (
                  <Flex key={language.code} align="center" justify="space-between" gap={3}>
                    <Text size={1}>{language.nativeName}</Text>
                    <Flex align="center" gap={3}>
                      <Text size={1} muted>
                        {language.status === 'off' ? '' : `${done} of ${documentCount} documents`}
                      </Text>
                      <Badge
                        tone={
                          language.status === 'live'
                            ? 'positive'
                            : language.status === 'preview'
                              ? 'caution'
                              : 'default'
                        }
                      >
                        {language.status}
                      </Badge>
                    </Flex>
                  </Flex>
                )
              })}
          </Stack>
        </Card>
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 3: Plugin wrapper** (`tools/translations/index.ts`)

```ts
import {TranslateIcon} from '@sanity/icons'
import {definePlugin} from 'sanity'
import {TranslationsTool} from './TranslationsTool'

export const translationsTool = definePlugin({
  name: 'translations-tool',
  tools: [
    {
      name: 'translations',
      title: 'Translations',
      icon: TranslateIcon,
      component: TranslationsTool,
    },
  ],
})
```

Register it in `sanity.config.ts`: `import {translationsTool} from './tools/translations'` and add `translationsTool()` to the `plugins` array.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run build && npm run dev
```

Expected: no type errors (if `TranslateIcon` is not exported from the root of `@sanity/icons` in this version, import it from `@sanity/icons/Translate` as the rest of the repo does for icons). In the Studio at http://localhost:3333 a **Translations** tab appears; it shows "All translations are up to date" (from the seeded `pendingCount: 0`), the language list with statuses, and the button. Pressing it before the webhooks exist only sets `requestedAt`; confirm in Vision (`*[_id=="translationStatus"][0].requestedAt`) that it changed.

- [ ] **Step 5: Commit (Studio repo)**

```bash
npx prettier --write tools sanity.config.ts && git add -A && git commit -m "feat: Translations tool with Translate all changes button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Key snapshot check

**Files (site repo):**
- Create: `scripts/translations-keys.ts`, `lib/crowdin/keys.snapshot.json` (generated)
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `extractStrings` (Task 2), `SOURCE_IDS`, `SOURCE_POSTS_QUERY` (Task 11).
- Produces: `npm run translations:check` (exit 1 with a readable diff when the set of translatable keys differs from the committed snapshot) and `npm run translations:snapshot` (rewrites it).

This is the safeguard for new fields: adding a copy field changes the key set, the check fails, and the snapshot diff in the PR shows exactly which strings will now go to translators.

- [ ] **Step 1: Script** (`scripts/translations-keys.ts`; no dependencies, published content is public)

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { extractStrings } from "../lib/crowdin/extract.ts";
import { SOURCE_IDS, SOURCE_POSTS_QUERY } from "../lib/crowdin/source-docs.ts";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "uruh3czl";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const SNAPSHOT = new URL("../lib/crowdin/keys.snapshot.json", import.meta.url);

async function query<T>(groq: string, params: Record<string, unknown> = {}): Promise<T> {
  const search = new URLSearchParams({ query: groq });
  for (const [key, value] of Object.entries(params)) search.set(`$${key}`, JSON.stringify(value));
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-01/data/query/${dataset}?${search}`);
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { result: T }).result;
}

const [singletons, posts] = await Promise.all([
  query<{ _id: string }[]>(`*[_id in $ids]`, { ids: SOURCE_IDS }),
  query<{ _id: string }[]>(SOURCE_POSTS_QUERY),
]);

const current: Record<string, string[]> = {};
for (const doc of singletons) current[doc._id] = Object.keys(extractStrings(doc)).sort();
current.post = [...new Set(posts.flatMap((post) => Object.keys(extractStrings(post))))].sort();

if (process.argv.includes("--write")) {
  writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  console.log("Snapshot written to lib/crowdin/keys.snapshot.json");
  process.exit(0);
}

const saved = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<string, string[]>;
let drift = false;
for (const name of new Set([...Object.keys(saved), ...Object.keys(current)])) {
  const before = new Set(saved[name] ?? []);
  const after = new Set(current[name] ?? []);
  const added = [...after].filter((key) => !before.has(key));
  const removed = [...before].filter((key) => !after.has(key));
  if (added.length || removed.length) {
    drift = true;
    console.error(`\n${name}:`);
    for (const key of added) console.error(`  + ${key}   (will be sent to translators)`);
    for (const key of removed) console.error(`  - ${key}`);
  }
}
if (drift) {
  console.error("\nThe translatable keys changed. If this is intended, run: npm run translations:snapshot");
  process.exit(1);
}
console.log("Translatable keys match the snapshot.");
```

- [ ] **Step 2: Scripts** in `package.json`

```json
    "translations:check": "node scripts/translations-keys.ts",
    "translations:snapshot": "node scripts/translations-keys.ts --write",
```

- [ ] **Step 3: Generate and verify**

```bash
npm run translations:snapshot && npm run translations:check
```

Expected: `Translatable keys match the snapshot.` Review `lib/crowdin/keys.snapshot.json`: no keys under `links`, `languages`, `date`, `url`; `siteSettings-en` includes `nav.languageMenu`; `post` includes `title`, `category`, `image.alt`. If a logic-only string appears (an id, an enum), add it to the deny rules in `extract.ts` with a test, then regenerate.

Prove the check bites: temporarily edit the snapshot (remove one key), run `npm run translations:check`, expect exit 1 with `+ <key>`; restore it.

- [ ] **Step 4: Commit**

```bash
npm run format && git add -A && git commit -m "feat: translatable key snapshot check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: Docs for people and for Claude Code

**Files:**
- Modify: `CLAUDE.md`, `README.md` (site repo); `README.md` (Studio repo)

- [ ] **Step 1: `CLAUDE.md`.** Make these edits (keep the `next dev`-managed block at the bottom untouched):

  - Rule 2: append "Language names in the switcher and its `aria-label` are Sanity content too (`siteSettings-en.languages`, `nav.languageMenu`)."
  - Rule 3: replace "assembled in `app/page.tsx`" with "assembled in `components/home/HomePage.tsx` (rendered by `app/(en)/page.tsx` and `app/[locale]/page.tsx`)".
  - "Working with Sanity": replace the "Adding a language means new `homePage-<code>`..." bullet with the section below, and add a "Direction" rule to "Non-negotiables" 1: "Use logical direction utilities (`ms/me/ps/pe/start/end`, `text-start/end`); physical ones only with an `rtl:` variant on the same line (`npm test` enforces this)."

Add this section after "Working with Sanity":

```markdown
## Languages (Crowdin)

English is authored in Sanity and lives at `/`; other languages live at `/<code>` (`lib/locales.ts` lists them).
Editors only edit English. A **Translate all changes** button (Studio > Translations tab) sends changed strings to
Crowdin, which machine-translates them; finished translations are stored as `translation-<code>-<sourceId>`
documents and merged over the English data at render time (`sanity/lib/localize.ts`).

- Every homepage/nav/footer fetch goes through `fetchLocalized(query, locale, sourceId, path)`; blog posts through
  `localizeDocs`. Never fetch copy with `fetchRequired` in a component that renders in other languages.
- New copy fields are translated automatically. After adding or changing a field (or seeding content for a new
  section) run `npm run translations:check`; if it reports new keys, review them (they go to translators), then run
  `npm run translations:snapshot` and commit the diff. Strings that are not copy (ids, enums, URLs) are skipped by rule
  in `lib/crowdin/extract.ts`; add a rule and a test there if a new non-copy string gets picked up.
- Rich text (Portable Text) is not supported by the extractor and throws on purpose.
- A language is `off`, `preview` (reachable by URL, hidden, `noindex`) or `live` (in the switcher, indexed), set per
  language in Studio > Site settings > Languages. No deploy is needed to change it.
- Adding a language: add it to `lib/locales.ts` (URL code, Crowdin id, `<html lang>`, direction) and to
  `schemaTypes/shared/language-codes.ts` in the Studio repo, add the language in Crowdin, then add an entry in
  Site settings > Languages. Right-to-left languages need `dir: "rtl"`.
- Secrets: `CROWDIN_API_TOKEN`, `CROWDIN_PROJECT_ID`, `CROWDIN_WEBHOOK_SECRET`, `SANITY_API_WRITE_TOKEN`,
  `CROWDIN_MT_ENGINE_ID` (see README). Never commit them.
```

  - Add to "Structure rules" a "New section checklist": schema fields in the Studio repo, starter content written to
    Sanity (the site never invents content), `npm run typegen`, `npm run translations:check`, `npm test`, `npm run build`.

- [ ] **Step 2: Site `README.md`.** Replace the "Languages" section with a pointer to `CLAUDE.md` plus this setup list, and add the new variables to the environment table:

```markdown
| `CROWDIN_API_TOKEN`      | Crowdin personal access token (project read/write). |
| `CROWDIN_PROJECT_ID`     | Crowdin project id (Tools > API). |
| `CROWDIN_WEBHOOK_SECRET` | Shared secret sent by Crowdin in the `X-Webhook-Secret` header. |
| `CROWDIN_MT_ENGINE_ID`   | Machine translation engine id (`node --env-file=.env.local scripts/crowdin-info.mjs` lists them). |
| `CROWDIN_PRETRANSLATE_METHOD` | Optional: `mt` (default), `tm` or `ai`. |
| `SANITY_API_WRITE_TOKEN` | Sanity **Editor** token; the sync writes translations and status with it. |
| `NEXT_PUBLIC_SITE_URL`   | Public origin, used for hreflang and the sitemap. Inlined at build time. |
```

Webhooks (three): Sanity "Translate all changes" -> `POST /api/crowdin/sync`, dataset `production`, trigger on update, filter `_type == "translationStatus" && delta::changedAny(requestedAt)`, same secret as the revalidate webhook; Sanity "Translation pending count" -> `POST /api/crowdin/changed`, trigger create/update/delete, filter `_type in ["homePage", "siteSettings", "post"]`; Crowdin (Project > Tools > Webhooks) -> `POST /api/crowdin`, events `file.translated` and `file.approved`, content type JSON, custom header `X-Webhook-Secret`.

- [ ] **Step 3: Studio `README.md`:** add three lines: the Translations tab (what the button does), the seed script (`npx sanity exec scripts/seed-translations.ts --with-user-token`, once), and that `LANGUAGE_CODES` must match the site's `lib/locales.ts`.

- [ ] **Step 4: Commit both repos**

```bash
cd /Users/jacobcogan/developer/habitat-rebuild-test && npm run format && git add -A && git commit -m "docs: languages workflow, env vars and webhooks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
cd ../studio-habitat-learn-test && git add -A && git commit -m "docs: translations tool and seed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 17: Setup and end-to-end verification (needs the user)

**Files:** none in git except any fixes found. This task needs credentials and outward-facing actions, so **ask the user before each numbered action that touches a live service** (writing secrets, deploying, creating webhooks).

- [ ] **Step 1: Local env (user provides values; do not echo them).** Add to `.env.local` and `.dev.vars` in the site repo: `CROWDIN_API_TOKEN`, `CROWDIN_PROJECT_ID`, `CROWDIN_WEBHOOK_SECRET` (any long random string), `SANITY_API_WRITE_TOKEN` (create an Editor token in Sanity Manage > API > Tokens), `NEXT_PUBLIC_SITE_URL` (the deployed origin).

- [ ] **Step 2: Reconcile languages and pick the engine**

```bash
node --env-file=.env.local scripts/crowdin-info.mjs
```

Expected: both "In lib/locales.ts but not in Crowdin" and "In Crowdin but not in lib/locales.ts" are empty (otherwise fix `crowdinId` values in `lib/locales.ts`, which the port test suite pins for `pt-br`, `zh-cn`, `zh-tw` and `nb`), and at least one machine translation engine is listed. If none, the user adds one in Crowdin > Tools > Machine Translation. Put its id in `CROWDIN_MT_ENGINE_ID`. The user also creates a glossary of brand terms and do-not-translate words (for example "Habitat Learn") in Crowdin.

- [ ] **Step 3: Deploy with the secrets (ask first).**

```bash
npx wrangler secret put CROWDIN_API_TOKEN     # and CROWDIN_PROJECT_ID, CROWDIN_WEBHOOK_SECRET,
npx wrangler secret put SANITY_API_WRITE_TOKEN  # CROWDIN_MT_ENGINE_ID
npm run cf:deploy
```

Then in the Studio repo `npx sanity deploy` so the deployed Studio has the Translations tab and the languages field.

- [ ] **Step 4: Create the three webhooks (ask first)** as listed in the README (Sanity Manage > API > Webhooks twice; Crowdin > Tools > Webhooks once).

- [ ] **Step 5: Round trip on Arabic (preview).** In the deployed Studio set Arabic to **Preview**, open Translations, press **Translate all changes**. Expected, in order, within a few minutes:
  1. The button shows loading; `translationStatus.running` is true then false.
  2. Crowdin lists `homePage-en.json`, `siteSettings-en.json` and up to three post files; Arabic is pre-translated.
  3. Cloudflare logs (`npx wrangler tail`) show `crowdin event {"stored":"ar__homePage-en",...}` for each file.
  4. `translation-ar-homePage-en` exists in the Studio's Vision tool.
  5. `<site>/ar` shows Arabic copy, `dir="rtl"`, and `<meta name="robots" content="noindex...">`; `/` is unchanged.
  If step 3 never appears, check the webhook delivery log in Crowdin and that the `X-Webhook-Secret` header matches; the next press pulls anything already complete (Task 11, step 4).

- [ ] **Step 6: Verify the Crowdin request shapes really worked** (Task 10 assumed them): the Crowdin file has the flat keys (for example `hero.title`, `hero.avatars[<key>].alt`), file type JSON, and the exported translation returned flat JSON. If the API rejected a request or returned nested JSON, fix `lib/crowdin/port.ts`, extend `port.test.ts` with the real shape, and repeat.

- [ ] **Step 7: Changed-string behavior.** Edit one English string in Sanity and Publish. Expected: the Studio counter reads "1 document changed" within a minute; pressing the button re-pushes only that document; in Crowdin only the changed string is untranslated and gets re-translated (other strings keep their translations); until `file.translated` fires, `/ar` still shows the previous Arabic; afterwards it shows the new text.

- [ ] **Step 8: Double press and failure.** Press the button twice quickly: logs show one run and one `skipped: already-running`. Temporarily set a wrong `CROWDIN_API_TOKEN` secret, press the button: the Studio shows "Last attempt failed: Crowdin ..." and the button re-enables; restore the token and press again to confirm recovery.

- [ ] **Step 9: Enable and check the rollout languages.** Set Arabic, Spanish and Japanese to **Live**. Expected: the switcher appears in the nav (dropdown at 1440, list in the mobile menu), each option has its own script, `/sitemap.xml` lists the three plus English with alternates, and hreflang links appear in `<head>`. Check visually at 1440, 820 and 390 for `/`, `/ar`, `/es`, `/ja`:
  - `/` is pixel-identical to the baseline apart from the new switcher (`node scripts/visual/check.mjs compare before after`; expect only the nav region to differ, then refresh the baseline).
  - `/ar` is fully mirrored (Task 9 checklist), no horizontal scroll, Arabic glyphs render in a proper Arabic face.
  - `/es` (long words) and `/ja` (CJK glyphs) do not overflow the nav, buttons or headings.
  Record any font or layout issue as a follow-up task; do not enable further languages until each has been glanced at.

- [ ] **Step 10: Final gate.** In the site repo: `npm run format && npm test && npm run lint && npm run build && npm run translations:check`; in the Studio repo: `npx tsc --noEmit && npm run build`. All clean. Push both `crowdin-i18n` branches only if the user asks; open PRs only if the user asks.

---

## Self-review

**Spec coverage** (spec section to task): Goal and URLs (1, 6); source of truth and extraction (2); manual sync model (11, 12, 14); format and key snapshot (2, 15); storage as per-source documents (2, 3, 4, 11, 12); tools via fetch (10); update option and previous translation retained (10, 11); no approval and per-locale status (3, 4, 6, 7, 8); completeness guard (11); fallback to English (2, 4); switcher copy from Sanity (3, 8); secrets (12, 16, 17); editor workflow and Translations tool with counter (12, 14); webhook route with secret header (13); locale routing (5, 6); RTL and direction guard (9); hreflang, noindex, sitemap (7); languages list and rollout (3, 17); fonts and layout checks (17 step 9); testing plan (all tasks); risks (Crowdin request shapes verified in 17 step 6; webhook needs public URL handled by deploying in step 3). Delivery automation (spec 4b) is intentionally a separate plan. **Spec deltas made while planning:** update option is `clear_translations_and_approvals` (the current API value, and the correct one for machine translation), Crowdin via `fetch` not the axios-based client, and the trigger is a Sanity-enforced `requestedAt` write plus a signed webhook; all recorded in spec v4.

**Placeholder scan:** no TBD/TODO; every code step shows code; the only "if X then Y" branches are real verification contingencies (icon import path, Crowdin response shape) with the concrete fix stated.

**Type consistency:** `StringMap`, `extractStrings`, `applyTranslations`, `hashStrings`, `parseStrings` (Task 2) are used unchanged in Tasks 4, 10, 11, 15; `storeKey`/`translationId` (Task 2) in 4, 11, 12; `SyncDeps` members defined in Task 11 are exactly those implemented in Task 12 (`now, readStatus, tryStart, saveDocuments, finish, setPending, markStored, loadSourceDocs, activeLocales, crowdin, storeTranslation, revalidate`); `CrowdinPort` methods match between Tasks 10 and 11; `getSiteSettings(locale)` and section `{ locale }` props match between Tasks 4 and 6.

**Review Focus coverage:** items 1 and 2 tested in Task 2; item 3 in Tasks 4 and 6; item 4 in Task 11; item 5 in Tasks 11 and 13.
