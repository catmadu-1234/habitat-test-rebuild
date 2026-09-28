// node --env-file=.env.local scripts/crowdin-info.mjs
import { LOCALES } from "../lib/locales.ts";

const token = process.env.CROWDIN_API_TOKEN;
const projectId = process.env.CROWDIN_PROJECT_ID;
const base = process.env.CROWDIN_API_BASE ?? "https://api.crowdin.com/api/v2";
if (!token || !projectId)
  throw new Error("Set CROWDIN_API_TOKEN and CROWDIN_PROJECT_ID (use --env-file=.env.local)");

async function get(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) return { error: `${response.status} ${text.slice(0, 200)}` };
  return JSON.parse(text);
}

const project = await get(`/projects/${projectId}`);
if (project.error) throw new Error(`Cannot read the project: ${project.error}`);
const targets = project.data.targetLanguages.map((l) => ({ id: l.id, name: l.name }));
console.log("Source language:", project.data.sourceLanguageId);
console.log("Target languages in Crowdin:", targets.map((t) => `${t.id} (${t.name})`).join(", "));

const wanted = LOCALES.filter((l) => l.code !== "en").map((l) => l.crowdinId);
const have = new Set(targets.map((t) => t.id));
console.log(
  "In lib/locales.ts but not in Crowdin:",
  wanted.filter((id) => !have.has(id)),
);
console.log(
  "In Crowdin but not in lib/locales.ts:",
  targets.map((t) => t.id).filter((id) => !wanted.includes(id)),
);

const engines = await get("/mts?limit=100");
console.log("Machine translation engines (use an id for CROWDIN_MT_ENGINE_ID):");
console.log(
  engines.error
    ? `  (could not list: ${engines.error})`
    : engines.data.map((e) => `  ${e.data.id}  ${e.data.name ?? e.data.type}`).join("\n") ||
        "  none configured: add one in Crowdin > Tools > Machine Translation",
);
