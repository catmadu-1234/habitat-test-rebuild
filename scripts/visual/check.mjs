// Visual regression helper for the Sanity migration.
//   node check.mjs capture <label> [baseUrl]      writes ../../.visual/<label>/
//   node check.mjs compare <baseline> <candidate> exits 1 on any difference beyond tolerance
// Needs CHROME_PATH pointing at a Chromium binary (see the plan, Task 1).
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.visual");
const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
];
const maxDiffRatio = 0.005;

// Freeze scroll-in animations and the marquee, and hide videos, so runs are repeatable.
const freeze = `
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  video { visibility: hidden !important; }
`;

async function capture(label, baseUrl = "http://localhost:3100") {
  const dir = path.join(outRoot, label);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const heights = {};
  const brokenImages = {};

  // Warm-up: the first load after a server start waits on next/image optimisation, which
  // leaves images half-decoded in the first screenshots. Load the page once per width first.
  for (const { width, height } of viewports) {
    const warm = await browser.newPage({ viewport: { width, height } });
    await warm.goto(baseUrl, { waitUntil: "networkidle" });
    await warm.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await warm.waitForLoadState("networkidle");
    await warm.close();
  }

  for (const { width, height } of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: freeze });
    // Scroll through the page so lazy images load, then return to the top.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    // Force every lazy image to load and decode, then record any that failed.
    const broken = await page.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
      });
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      return [...document.images].filter((img) => !img.naturalWidth).map((img) => img.src);
    });
    if (broken.length)
      console.log(`${width}: ${broken.length} broken image(s): ${broken.join(", ")}`);
    brokenImages[width] = broken.length;
    await page.evaluate(() => document.fonts.ready);
    heights[width] = await page.evaluate(() =>
      [...document.querySelectorAll("main > section, footer")].map((el) =>
        Math.round(el.getBoundingClientRect().height),
      ),
    );
    await page.screenshot({ path: path.join(dir, `${width}.png`), fullPage: true });
    await page.close();
  }

  await browser.close();
  writeFileSync(path.join(dir, "heights.json"), JSON.stringify(heights, null, 2));
  writeFileSync(path.join(dir, "broken.json"), JSON.stringify(brokenImages));
  console.log(`${label}: ${JSON.stringify(heights)}`);
}

function compare(baseline, candidate) {
  let failed = false;
  const heightsA = JSON.parse(readFileSync(path.join(outRoot, baseline, "heights.json"), "utf8"));
  const heightsB = JSON.parse(readFileSync(path.join(outRoot, candidate, "heights.json"), "utf8"));

  for (const { width } of viewports) {
    if (JSON.stringify(heightsA[width]) !== JSON.stringify(heightsB[width])) {
      console.log(`${width}: section heights differ ${heightsA[width]} vs ${heightsB[width]}`);
      failed = true;
    }
    const a = PNG.sync.read(readFileSync(path.join(outRoot, baseline, `${width}.png`)));
    const b = PNG.sync.read(readFileSync(path.join(outRoot, candidate, `${width}.png`)));
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`${width}: page size differs ${a.width}x${a.height} vs ${b.width}x${b.height}`);
      failed = true;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const ratio = changed / (a.width * a.height);
    writeFileSync(path.join(outRoot, candidate, `diff-${width}.png`), PNG.sync.write(diff));
    console.log(`${width}: ${changed} px differ (${(ratio * 100).toFixed(3)}%)`);
    if (ratio > maxDiffRatio) failed = true;
  }

  const brokenB = JSON.parse(readFileSync(path.join(outRoot, candidate, "broken.json"), "utf8"));
  for (const [width, count] of Object.entries(brokenB)) {
    if (count > 0) {
      console.log(`${width}: ${count} broken image(s) in candidate`);
      failed = true;
    }
  }

  console.log(failed ? "FAIL" : "PASS");
  process.exit(failed ? 1 : 0);
}

const [command, ...args] = process.argv.slice(2);
if (command === "capture") await capture(...args);
else if (command === "compare") compare(...args);
else {
  console.error("usage: check.mjs capture <label> [baseUrl] | compare <baseline> <candidate>");
  process.exit(2);
}
