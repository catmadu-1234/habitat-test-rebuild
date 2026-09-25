import assert from "node:assert/strict";
import { test } from "node:test";
import { createCrowdinPort } from "./port.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(routes: Record<string, unknown | ((call: Call) => unknown)>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    const key = `${call.method} ${url.replace("https://api.crowdin.com/api/v2", "").replace("https://cdn.example", "CDN")}`;
    const hit = Object.entries(routes).find(([pattern]) => key.startsWith(pattern));
    if (!hit) return new Response(`no route for ${key}`, { status: 500 });
    const value = typeof hit[1] === "function" ? (hit[1] as (c: Call) => unknown)(call) : hit[1];
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

const base = { token: "t0k", projectId: 7, method: "mt" as const, engineId: 3 };

test("creates a new file when none exists: storage upload, then file create", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 11 } },
    "GET /projects/7/files": { data: [{ data: { id: 5, name: "other.json" } }] },
    "POST /projects/7/files": { data: { id: 99 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  const id = await port.upsertFile({ name: "homePage-en.json", content: '{"a":"b"}' });
  assert.equal(id, 99);
  const storage = calls.find((c) => c.url.endsWith("/storages"))!;
  assert.equal(storage.headers["Crowdin-API-FileName"], "homePage-en.json");
  assert.equal(storage.headers.Authorization, "Bearer t0k");
  assert.equal(storage.body, '{"a":"b"}');
  const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/projects/7/files"))!;
  assert.deepEqual(JSON.parse(create.body!), {
    storageId: 11,
    name: "homePage-en.json",
    type: "json",
  });
});

test("updates an existing file (known id) and clears translations of changed strings", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 12 } },
    "PUT /projects/7/files/99": { data: { id: 99 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  assert.equal(await port.upsertFile({ name: "homePage-en.json", content: "{}", fileId: 99 }), 99);
  const put = calls.find((c) => c.method === "PUT")!;
  assert.deepEqual(JSON.parse(put.body!), {
    storageId: 12,
    updateOption: "clear_translations_and_approvals",
  });
});

test("finds an existing file by name when the id is unknown, then updates it", async () => {
  const { impl, calls } = fakeFetch({
    "POST /storages": { data: { id: 13 } },
    "GET /projects/7/files": { data: [{ data: { id: 42, name: "homePage-en.json" } }] },
    "PUT /projects/7/files/42": { data: { id: 42 } },
  });
  const port = createCrowdinPort({ ...base, fetchImpl: impl });
  assert.equal(await port.upsertFile({ name: "homePage-en.json", content: "{}" }), 42);
  assert.ok(calls.some((c) => c.method === "PUT" && c.url.endsWith("/files/42")));
});

test("preTranslate sends the method, engine, languages and files", async () => {
  const { impl, calls } = fakeFetch({
    "POST /projects/7/pre-translations": { data: { identifier: "x" } },
  });
  await createCrowdinPort({ ...base, fetchImpl: impl }).preTranslate({
    fileIds: [1, 2],
    languageIds: ["ar", "es"],
  });
  assert.deepEqual(JSON.parse(calls[0].body!), {
    languageIds: ["ar", "es"],
    fileIds: [1, 2],
    method: "mt",
    engineId: 3,
    scope: "untranslated",
  });
});

test("getProgress flattens the per-language rows", async () => {
  const { impl } = fakeFetch({
    "GET /projects/7/files/99/languages/progress": {
      data: [
        { data: { languageId: "ar", translationProgress: 100 } },
        { data: { languageId: "es", translationProgress: 40 } },
      ],
    },
  });
  assert.deepEqual(await createCrowdinPort({ ...base, fetchImpl: impl }).getProgress(99), [
    { languageId: "ar", translationProgress: 100 },
    { languageId: "es", translationProgress: 40 },
  ]);
});

test("downloadTranslation builds the file, fetches the URL and returns the string map", async () => {
  const { impl, calls } = fakeFetch({
    "POST /projects/7/translations/builds/files/99": {
      data: { url: "https://cdn.example/x.json" },
    },
    "GET CDN/x.json": { "hero.title": "Hola", ignored: 5 },
  });
  const map = await createCrowdinPort({ ...base, fetchImpl: impl }).downloadTranslation(99, "es");
  assert.deepEqual(map, { "hero.title": "Hola" });
  assert.deepEqual(JSON.parse(calls[0].body!), { targetLanguageId: "es" });
  assert.equal(
    calls[1].headers.Authorization,
    undefined,
    "the signed download URL must not get the API token",
  );
});

test("downloadTranslation refuses nested JSON so an unexpected export shape is noticed", async () => {
  const { impl } = fakeFetch({
    "POST /projects/7/translations/builds/files/99": {
      data: { url: "https://cdn.example/x.json" },
    },
    "GET CDN/x.json": { hero: { title: "Hola" } },
  });
  await assert.rejects(
    createCrowdinPort({ ...base, fetchImpl: impl }).downloadTranslation(99, "es"),
    /nested/i,
  );
});

test("a non-2xx response throws with the status and a body excerpt", async () => {
  const { impl } = fakeFetch({});
  await assert.rejects(
    createCrowdinPort({ ...base, fetchImpl: impl }).getProgress(1),
    /Crowdin GET .* failed: 500/,
  );
});
