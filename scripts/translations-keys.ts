import { readFileSync, writeFileSync } from "node:fs";
import { extractStrings } from "../lib/crowdin/extract.ts";
import { SOURCE_IDS, SOURCE_POSTS_QUERY } from "../lib/crowdin/source-docs.ts";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "uruh3czl";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const SNAPSHOT = new URL("../lib/crowdin/keys.snapshot.json", import.meta.url);

async function query<T>(groq: string, params: Record<string, unknown> = {}): Promise<T> {
  const search = new URLSearchParams({ query: groq });
  for (const [key, value] of Object.entries(params)) search.set(`$${key}`, JSON.stringify(value));
  const response = await fetch(
    `https://${projectId}.api.sanity.io/v2026-09-01/data/query/${dataset}?${search}`,
  );
  if (!response.ok)
    throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { result: T }).result;
}

const [singletons, posts] = await Promise.all([
  query<{ _id: string }[]>(`*[_id in $ids]`, { ids: SOURCE_IDS }),
  query<{ _id: string }[]>(SOURCE_POSTS_QUERY),
]);

// Snapshot field shapes, not content instances: `[<_key>]` segments become `[]`, so adding a list item in Sanity does not trip the check.
const shapes = (docs: object[]) =>
  [
    ...new Set(
      docs.flatMap((doc) =>
        Object.keys(extractStrings(doc)).map((key) => key.replace(/\[[^\]]*\]/g, "[]")),
      ),
    ),
  ].sort();

const current: Record<string, string[]> = {};
for (const doc of singletons) current[doc._id] = shapes([doc]);
current.post = shapes(posts);

if (process.argv.includes("--write")) {
  writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  console.log("Snapshot written to lib/crowdin/keys.snapshot.json");
  process.exit(0);
}

const saved = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<string, string[]>;
let drift = false;
for (const name of new Set([...Object.keys(saved), ...Object.keys(current)])) {
  const before = new Set(saved[name] ?? []);
  const after = new Set(current[name] ?? []);
  const added = [...after].filter((key) => !before.has(key));
  const removed = [...before].filter((key) => !after.has(key));
  if (added.length || removed.length) {
    drift = true;
    console.error(`\n${name}:`);
    for (const key of added) console.error(`  + ${key}   (will be sent to translators)`);
    for (const key of removed) console.error(`  - ${key}`);
  }
}
if (drift) {
  console.error(
    "\nThe translatable keys changed. If this is intended, run: npm run translations:snapshot",
  );
  process.exit(1);
}
console.log("Translatable keys match the snapshot.");
