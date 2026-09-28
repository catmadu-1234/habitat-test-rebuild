import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSiteUrl } from "./site-url.ts";

test("prefers NEXT_PUBLIC_SITE_URL and trims trailing slashes", () => {
  assert.equal(
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://habitatlearn.com/" }),
    "https://habitatlearn.com",
  );
});

test("falls back to the Vercel production domain, then localhost", () => {
  assert.equal(
    resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
    "https://x.vercel.app",
  );
  assert.equal(resolveSiteUrl({}), "http://localhost:3000");
});
