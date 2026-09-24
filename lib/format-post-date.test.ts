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

test("returns an empty string for a missing or unparsable date (half-filled draft posts)", () => {
  assert.equal(formatPostDate(undefined), "");
  assert.equal(formatPostDate(null), "");
  assert.equal(formatPostDate(""), "");
  assert.equal(formatPostDate("not-a-date"), "");
});
