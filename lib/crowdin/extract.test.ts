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
      {
        _key: "a1",
        _type: "imageWithAlt",
        alt: "School one",
        asset: { _ref: "image-1", _type: "reference" },
      },
      {
        _key: "b2",
        _type: "imageWithAlt",
        alt: "School two",
        asset: { _ref: "image-2", _type: "reference" },
      },
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
  assert.deepEqual(extractStrings({ items: ["one", "two"] }), {
    "items[0]": "one",
    "items[1]": "two",
  });
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
  const out = applyTranslations(home, {
    "hero.title": "Aprendamos juntos",
    "hero.avatars[a1].alt": "Escuela uno",
  });
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
