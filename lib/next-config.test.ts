import assert from "node:assert/strict";
import { test } from "node:test";
import nextConfig from "../next.config.ts";

test("the image optimizer only proxies this project's Sanity images", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const sanity = patterns.filter(
    (pattern) =>
      typeof pattern === "object" && "hostname" in pattern && pattern.hostname === "cdn.sanity.io",
  );
  assert.equal(sanity.length, 1);
  const pathname = "pathname" in sanity[0] ? sanity[0].pathname : undefined;
  assert.equal(pathname, "/images/uruh3czl/production/**");
});
