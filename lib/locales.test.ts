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
  assert.deepEqual(
    LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code),
    ["ar"],
  );
  assert.ok(NON_DEFAULT_LOCALES.every((l) => l.code !== "en"));
});

test("maps the agreed regional variants", () => {
  // Crowdin's project has European Portuguese (pt-PT), not Brazilian; see lib/locales.ts.
  assert.equal(getLocale("pt-br")?.crowdinId, "pt-PT");
  assert.equal(getLocale("zh-cn")?.htmlLang, "zh-CN");
  assert.equal(getLocale("zh-tw")?.crowdinId, "zh-TW");
  // Crowdin's project uses plain Norwegian ("no"), not the "nb" bokmål-specific code.
assert.equal(getLocale("nb")?.crowdinId, "no");
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
