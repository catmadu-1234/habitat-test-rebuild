import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SOURCE_POSTS_QUERY } from "./source-docs.ts";

test("SOURCE_POSTS_QUERY matches the query the homepage renders", () => {
  assert.ok(readFileSync("sanity/queries.ts", "utf8").includes(SOURCE_POSTS_QUERY));
});
