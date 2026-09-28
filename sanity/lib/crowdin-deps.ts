import { revalidateTag } from "next/cache";
import { translationId } from "@/lib/crowdin/ids";
import { createCrowdinPort } from "@/lib/crowdin/port";
import { SOURCE_IDS, SOURCE_POSTS_QUERY } from "@/lib/crowdin/source-docs";
import type { SyncDeps, SyncDocuments, SyncStatus } from "@/lib/crowdin/sync";
import { activeLocales } from "@/lib/languages";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { getWriteClient } from "./write-client";

const STATUS_ID = "translationStatus";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const optionalNumber = (value: string | undefined) => (value ? Number(value) : undefined);

type StatusDoc = {
  _rev: string;
  running?: boolean;
  runStartedAt?: string;
  documents?: { _key: string; hash?: string; fileId?: number }[];
  stored?: { _key: string; hash?: string }[];
};

const toArray = (documents: SyncDocuments) =>
  Object.entries(documents).map(([key, value]) => ({
    _key: key,
    _type: "syncedDocument",
    hash: value.hash,
    fileId: value.fileId,
  }));

export function createSyncDeps(): SyncDeps {
  const sanity = getWriteClient();
  const crowdin = createCrowdinPort({
    token: requireEnv("CROWDIN_API_TOKEN"),
    projectId: Number(requireEnv("CROWDIN_PROJECT_ID")),
    baseUrl: process.env.CROWDIN_API_BASE,
    method: (process.env.CROWDIN_PRETRANSLATE_METHOD ?? "mt") as "tm" | "mt" | "ai",
    engineId: optionalNumber(process.env.CROWDIN_MT_ENGINE_ID),
    aiPromptId: optionalNumber(process.env.CROWDIN_AI_PROMPT_ID),
  });

  return {
    now: () => new Date(),
    crowdin,

    async readStatus(): Promise<SyncStatus> {
      await sanity.createIfNotExists({ _id: STATUS_ID, _type: "translationStatus" });
      const doc = await sanity.fetch<StatusDoc>(`*[_id == $id][0]`, { id: STATUS_ID });
      const documents: SyncDocuments = {};
      for (const item of doc.documents ?? []) {
        if (item.hash && typeof item.fileId === "number")
          documents[item._key] = { hash: item.hash, fileId: item.fileId };
      }
      const stored: Record<string, string> = {};
      for (const item of doc.stored ?? []) if (item.hash) stored[item._key] = item.hash;
      return {
        rev: doc._rev,
        running: Boolean(doc.running),
        runStartedAt: doc.runStartedAt,
        documents,
        stored,
      };
    },

    async tryStart(rev, startedAt) {
      try {
        await sanity
          .patch(STATUS_ID)
          .ifRevisionId(rev)
          .set({ running: true, runStartedAt: startedAt })
          .commit();
        return true;
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 409) return false;
        throw error;
      }
    },

    async saveDocuments(documents) {
      await sanity
        .patch(STATUS_ID)
        .set({ documents: toArray(documents) })
        .commit();
    },

    async finish(update) {
      let patch = sanity.patch(STATUS_ID).set({ running: false });
      if (update.documents) patch = patch.set({ documents: toArray(update.documents) });
      if (update.lastSyncAt) patch = patch.set({ lastSyncAt: update.lastSyncAt });
      if (update.pendingCount !== undefined)
        patch = patch.set({ pendingCount: update.pendingCount });
      patch =
        update.lastError === null
          ? patch.unset(["lastError"])
          : patch.set({ lastError: update.lastError });
      await patch.commit();
    },

    async setPending(count) {
      await sanity.createIfNotExists({ _id: STATUS_ID, _type: "translationStatus" });
      await sanity.patch(STATUS_ID).set({ pendingCount: count }).commit();
    },

    // One small transaction per (language, source): replace that entry without touching the others.
    async markStored(key, hash, at) {
      const selector = `stored[_key=="${key}"]`;
      await sanity
        .transaction()
        .patch(STATUS_ID, (p) => p.setIfMissing({ stored: [] }))
        .patch(STATUS_ID, (p) => p.unset([selector]))
        .patch(STATUS_ID, (p) =>
          p.insert("after", "stored[-1]", [
            { _key: key, _type: "storedTranslation", hash, storedAt: at },
          ]),
        )
        .commit();
    },

    async loadSourceDocs() {
      const [singletons, posts] = await Promise.all([
        sanity.fetch<Record<string, unknown>[]>(`*[_id in $ids]`, { ids: SOURCE_IDS }),
        sanity.fetch<Record<string, unknown>[]>(SOURCE_POSTS_QUERY),
      ]);
      return [...singletons, ...posts].map((doc) => ({ id: String(doc._id), doc }));
    },

    async activeLocales() {
      const rows = await sanity.fetch<{ code?: string; status?: string }[] | null>(
        `*[_id == "siteSettings-en"][0].languages`,
      );
      return activeLocales(rows);
    },

    async storeTranslation({ code, sourceId, hash, strings, at }) {
      await sanity.createOrReplace({
        _id: translationId(code, sourceId),
        _type: "translation",
        language: code,
        source: sourceId,
        hash,
        updatedAt: at,
        json: JSON.stringify(strings),
      });
    },

    async revalidate() {
      revalidateTag(SANITY_CACHE_TAG, { expire: 0 });
    },
  };
}
