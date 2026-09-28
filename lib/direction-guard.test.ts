import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PHYSICAL_UTILITY } from "./direction-guard.ts";

test("the pattern flags physical utilities and lets logical ones through", () => {
  for (const bad of [
    'className="ml-4"',
    "-mr-1",
    "md:pl-content",
    "left-0",
    "text-left",
    "border-l",
    "rounded-r-lg",
    "group-hover:translate-x-full",
    "bg-gradient-to-r",
  ]) {
    assert.ok(PHYSICAL_UTILITY.test(bad), `should flag ${bad}`);
  }
  for (const ok of [
    'className="ms-4"',
    "-me-1",
    "lg:ps-content",
    "start-0",
    "text-start",
    "border-s",
    "rounded-e-lg",
    "pl",
    "primary-left",
  ]) {
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
  assert.deepEqual(
    offenders,
    [],
    `Use logical utilities or add an rtl: variant:\n${offenders.join("\n")}`,
  );
});
