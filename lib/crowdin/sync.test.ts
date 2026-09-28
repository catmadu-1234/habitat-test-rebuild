import assert from "node:assert/strict";
import { test } from "node:test";
import type { StringMap } from "./extract.ts";
import { extractStrings, hashStrings } from "./extract.ts";
import { storeKey } from "./ids.ts";
import type { CrowdinPort } from "./port.ts";
import {
  computePending,
  handleFileEvent,
  runSync,
  type SyncDeps,
  type SyncStatus,
} from "./sync.ts";
import { getLocale } from "../locales.ts";

const ar = getLocale("ar")!;
const es = getLocale("es")!;
const home = { _id: "homePage-en", hero: { title: "Learn together" } };
const settings = { _id: "siteSettings-en", meta: { title: "Habitat" } };

type Log = { name: string; args: unknown }[];

function harness(
  over: {
    status?: Partial<SyncStatus>;
    docs?: { id: string; doc: unknown }[];
    locales?: (typeof ar)[];
    progress?: Record<number, { languageId: string; translationProgress: number }[]>;
    tryStart?: boolean;
    failPreTranslate?: boolean;
    now?: string;
  } = {},
) {
  const log: Log = [];
  const record = (name: string) => (args: unknown) => {
    log.push({ name, args });
  };
  const status: SyncStatus = {
    rev: "r1",
    running: false,
    documents: {},
    stored: {},
    ...over.status,
  };
  let nextFileId = 100;
  const crowdin: CrowdinPort = {
    async upsertFile(args) {
      record("upsertFile")(args);
      return args.fileId ?? nextFileId++;
    },
    async preTranslate(args) {
      record("preTranslate")(args);
      if (over.failPreTranslate) throw new Error("mt down");
    },
    async getProgress(fileId) {
      return over.progress?.[fileId] ?? [];
    },
    async downloadTranslation(fileId, languageId) {
      record("download")({ fileId, languageId });
      return { "hero.title": `[${languageId}]` } as StringMap;
    },
  };
  const deps: SyncDeps = {
    now: () => new Date(over.now ?? "2026-09-25T12:00:00Z"),
    readStatus: async () => status,
    tryStart: async (rev, startedAt) => {
      record("tryStart")({ rev, startedAt });
      return over.tryStart ?? true;
    },
    saveDocuments: async (documents) => record("saveDocuments")(documents),
    finish: async (update) => record("finish")(update),
    setPending: async (count) => record("setPending")(count),
    markStored: async (key, hash) => record("markStored")({ key, hash }),
    loadSourceDocs: async () =>
      over.docs ?? [
        { id: "homePage-en", doc: home },
        { id: "siteSettings-en", doc: settings },
      ],
    activeLocales: async () => over.locales ?? [ar],
    crowdin,
    storeTranslation: async (input) =>
      record("storeTranslation")({ code: input.code, sourceId: input.sourceId, hash: input.hash }),
    revalidate: async () => record("revalidate")(null),
  };
  return { deps, log, names: () => log.map((entry) => entry.name) };
}

const homeHash = () => hashStrings(extractStrings(home));

test("pushes every new document, pre-translates once for the active languages, saves documents first", async () => {
  const { deps, log, names } = harness({ locales: [ar, es] });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, ["homePage-en", "siteSettings-en"]);
  const upserts = log
    .filter((e) => e.name === "upsertFile")
    .map((e) => e.args as { name: string; content: string });
  assert.deepEqual(
    upserts.map((u) => u.name),
    ["homePage-en.json", "siteSettings-en.json"],
  );
  assert.deepEqual(JSON.parse(upserts[0].content), { "hero.title": "Learn together" });
  const pre = log.find((e) => e.name === "preTranslate")!.args as {
    fileIds: number[];
    languageIds: string[];
  };
  assert.deepEqual(pre.languageIds, ["ar", "es"]);
  assert.equal(pre.fileIds.length, 2);
  assert.ok(names().indexOf("saveDocuments") > -1);
  assert.ok(names().indexOf("saveDocuments") < names().indexOf("preTranslate"));
  assert.equal(names().filter((n) => n === "preTranslate").length, 1);
});

test("skips documents whose hash is unchanged and does not pre-translate when nothing changed", async () => {
  const { deps, names } = harness({
    status: {
      documents: {
        "homePage-en": { hash: await homeHash(), fileId: 7 },
        "siteSettings-en": { hash: await hashStrings(extractStrings(settings)), fileId: 8 },
      },
      stored: {
        [storeKey("ar", "homePage-en")]: await homeHash(),
        [storeKey("ar", "siteSettings-en")]: await hashStrings(extractStrings(settings)),
      },
    },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, []);
  assert.ok(!names().includes("upsertFile"));
  assert.ok(!names().includes("preTranslate"));
});

test("only the changed document is re-pushed, reusing its Crowdin file id", async () => {
  const { deps, log } = harness({
    status: {
      documents: {
        "homePage-en": { hash: "old", fileId: 7 },
        "siteSettings-en": { hash: await hashStrings(extractStrings(settings)), fileId: 8 },
      },
    },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.pushed, ["homePage-en"]);
  assert.equal((log.find((e) => e.name === "upsertFile")!.args as { fileId?: number }).fileId, 7);
});

test("does not call pre-translation when no language is active", async () => {
  const { deps, names } = harness({ locales: [] });
  await runSync(deps);
  assert.ok(names().includes("upsertFile"));
  assert.ok(!names().includes("preTranslate"));
});

test("stores complete languages, skips incomplete ones, revalidates once, marks what it stored", async () => {
  const hash = await homeHash();
  const { deps, log } = harness({
    locales: [ar, es],
    status: { documents: { "homePage-en": { hash, fileId: 7 } } },
    docs: [{ id: "homePage-en", doc: home }],
    progress: {
      7: [
        { languageId: "ar", translationProgress: 100 },
        { languageId: "es", translationProgress: 60 },
      ],
    },
  });
  const result = await runSync(deps);
  assert.deepEqual(result.stored, [storeKey("ar", "homePage-en")]);
  assert.deepEqual(
    log.filter((e) => e.name === "download").map((e) => e.args),
    [{ fileId: 7, languageId: "ar" }],
  );
  assert.equal(log.filter((e) => e.name === "revalidate").length, 1);
  assert.deepEqual(log.find((e) => e.name === "markStored")!.args, {
    key: "ar__homePage-en",
    hash,
  });
});

test("does not re-download a translation that is already stored for the current hash", async () => {
  const hash = await homeHash();
  const { deps, names } = harness({
    status: {
      documents: { "homePage-en": { hash, fileId: 7 } },
      stored: { [storeKey("ar", "homePage-en")]: hash },
    },
    docs: [{ id: "homePage-en", doc: home }],
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }] },
  });
  await runSync(deps);
  assert.ok(!names().includes("download"));
  assert.ok(!names().includes("revalidate"));
});

test("REVIEW: a second press while a fresh run is in progress is a no-op", async () => {
  const { deps, names } = harness({
    status: { running: true, runStartedAt: "2026-09-25T11:59:00Z" },
  });
  const result = await runSync(deps);
  assert.equal(result.skipped, "already-running");
  assert.deepEqual(names(), []);
});

test("a stale lock (older than 10 minutes) is taken over", async () => {
  const { deps, names } = harness({
    status: { running: true, runStartedAt: "2026-09-25T11:00:00Z" },
  });
  const result = await runSync(deps);
  assert.equal(result.skipped, undefined);
  assert.ok(names().includes("tryStart"));
});

test("REVIEW: losing the optimistic lock race is a no-op", async () => {
  const { deps, names } = harness({ tryStart: false });
  const result = await runSync(deps);
  assert.equal(result.skipped, "already-running");
  assert.ok(!names().includes("upsertFile"));
});

test("REVIEW: a Crowdin failure records the error, clears running, and reverts documents so the next press retries", async () => {
  const previous = { "homePage-en": { hash: "old", fileId: 7 } };
  const { deps, log } = harness({ status: { documents: previous }, failPreTranslate: true });
  await assert.rejects(runSync(deps), /mt down/);
  const finish = log.filter((e) => e.name === "finish").pop()!.args as {
    documents?: unknown;
    lastError: string | null;
  };
  assert.equal(finish.lastError, "mt down");
  assert.deepEqual(finish.documents, previous);
  assert.ok(
    !log.some((e) => e.name === "storeTranslation"),
    "no translations are replaced on failure",
  );
});

test("a successful run clears the error and the pending count", async () => {
  const { deps, log } = harness();
  await runSync(deps);
  const finish = log.filter((e) => e.name === "finish").pop()!.args as {
    lastError: string | null;
    pendingCount?: number;
  };
  assert.equal(finish.lastError, null);
  assert.equal(finish.pendingCount, 0);
});

test("REVIEW: webhook events for unknown files, inactive languages and incomplete files are ignored, not errors", async () => {
  const hash = await homeHash();
  const known = { status: { documents: { "homePage-en": { hash, fileId: 7 } } } };
  assert.deepEqual(await handleFileEvent(harness(known).deps, { fileId: 999, languageId: "ar" }), {
    ignored: "unknown-file",
  });
  assert.deepEqual(
    await handleFileEvent(harness({ ...known, locales: [es] }).deps, {
      fileId: 7,
      languageId: "ar",
    }),
    { ignored: "inactive-language" },
  );
  const incomplete = harness({
    ...known,
    progress: { 7: [{ languageId: "ar", translationProgress: 80 }] },
  });
  assert.deepEqual(await handleFileEvent(incomplete.deps, { fileId: 7, languageId: "ar" }), {
    ignored: "incomplete",
  });
  assert.ok(!incomplete.names().includes("storeTranslation"));
});

test("a complete file event stores the translation, marks it, and revalidates", async () => {
  const hash = await homeHash();
  const { deps, names, log } = harness({
    status: { documents: { "homePage-en": { hash, fileId: 7 } } },
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }] },
  });
  assert.deepEqual(await handleFileEvent(deps, { fileId: 7, languageId: "ar" }), {
    stored: "ar__homePage-en",
  });
  assert.deepEqual(
    names().filter((n) => ["download", "storeTranslation", "markStored", "revalidate"].includes(n)),
    ["download", "storeTranslation", "markStored", "revalidate"],
  );
  assert.deepEqual(log.find((e) => e.name === "storeTranslation")!.args, {
    code: "ar",
    sourceId: "homePage-en",
    hash,
  });
});

test("computePending counts documents whose hash differs from the last push (or never pushed)", async () => {
  const { deps } = harness({
    status: {
      documents: {
        "homePage-en": { hash: await homeHash(), fileId: 7 },
        "siteSettings-en": { hash: "stale", fileId: 8 },
      },
    },
  });
  assert.equal(await computePending(deps), 1);
  const fresh = harness();
  assert.equal(await computePending(fresh.deps), 2);
});

test("FIX: a language switched on later is pre-translated for unchanged files it has not stored", async () => {
  const hash = await homeHash();
  const { deps, log } = harness({
    locales: [ar, es],
    status: {
      documents: { "homePage-en": { hash, fileId: 7 } },
      stored: { [storeKey("ar", "homePage-en")]: hash },
    },
    docs: [{ id: "homePage-en", doc: home }],
    progress: { 7: [{ languageId: "es", translationProgress: 10 }] },
  });
  await runSync(deps);
  const pre = log.find((e) => e.name === "preTranslate")!.args as {
    fileIds: number[];
    languageIds: string[];
  };
  assert.deepEqual(pre.fileIds, [7]);
  assert.deepEqual(pre.languageIds, ["ar", "es"]);
  assert.ok(!log.some((e) => e.name === "upsertFile"));
});

test("FIX: no pre-translation when every active language is already stored for unchanged files", async () => {
  const hash = await homeHash();
  const { deps, names } = harness({
    status: {
      documents: { "homePage-en": { hash, fileId: 7 } },
      stored: { [storeKey("ar", "homePage-en")]: hash },
    },
    docs: [{ id: "homePage-en", doc: home }],
  });
  await runSync(deps);
  assert.ok(!names().includes("preTranslate"));
});

test("FIX: documents that dropped out of the sources are not pulled and are removed from the saved map", async () => {
  const hash = await homeHash();
  const { deps, log } = harness({
    status: {
      documents: {
        "homePage-en": { hash, fileId: 7 },
        "post-old": { hash: "x", fileId: 55 },
      },
    },
    docs: [{ id: "homePage-en", doc: home }],
    progress: { 7: [{ languageId: "ar", translationProgress: 100 }] },
  });
  const progressCalls: number[] = [];
  const original = deps.crowdin.getProgress;
  deps.crowdin.getProgress = async (fileId) => {
    progressCalls.push(fileId);
    return original(fileId);
  };
  await runSync(deps);
  assert.ok(!progressCalls.includes(55));
  const finish = log.filter((e) => e.name === "finish").pop()!.args as {
    documents: Record<string, unknown>;
  };
  assert.deepEqual(Object.keys(finish.documents), ["homePage-en"]);
});

test("FIX: a failing finish() in the error path does not hide the original error", async () => {
  const { deps } = harness({ failPreTranslate: true });
  deps.finish = async () => {
    throw new Error("finish down");
  };
  await assert.rejects(runSync(deps), /mt down/);
});

test("FIX: a lock lost only because the revision moved is retried once against the fresh status", async () => {
  const { deps, names } = harness();
  let calls = 0;
  deps.tryStart = async () => {
    calls += 1;
    return calls > 1;
  };
  await runSync(deps);
  assert.equal(calls, 2);
  assert.ok(names().includes("upsertFile"));
});
