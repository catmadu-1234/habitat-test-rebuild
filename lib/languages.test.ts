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
  assert.deepEqual(
    liveLanguages([
      { code: "en", nativeName: "English", status: "live" },
      { code: "ar", status: "live" },
    ]),
    [{ code: "en", nativeName: "English" }],
  );
});

test("activeLocales are the non-default preview and live locales", () => {
  assert.deepEqual(
    activeLocales(rows).map((l) => l.code),
    ["es", "ar"],
  );
});
