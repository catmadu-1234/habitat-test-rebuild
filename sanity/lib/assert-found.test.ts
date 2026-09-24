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
