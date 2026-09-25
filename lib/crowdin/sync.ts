import type { LocaleConfig } from "../locales.ts";
import { extractStrings, hashStrings, type StringMap } from "./extract.ts";
import { storeKey } from "./ids.ts";
import type { CrowdinPort } from "./port.ts";

export type SourceDoc = { id: string; doc: unknown };
export type SyncDocuments = Record<string, { hash: string; fileId: number }>;
export type SyncStatus = {
  rev: string;
  running: boolean;
  runStartedAt?: string;
  documents: SyncDocuments;
  /** storeKey(code, sourceId) -> the source hash the stored translation was built for */
  stored: Record<string, string>;
};

export type SyncDeps = {
  now(): Date;
  readStatus(): Promise<SyncStatus>;
  /** Optimistic lock on the status document: false if someone else changed it first. */
  tryStart(rev: string, startedAt: string): Promise<boolean>;
  saveDocuments(documents: SyncDocuments): Promise<void>;
  finish(update: {
    documents?: SyncDocuments;
    lastSyncAt?: string;
    pendingCount?: number;
    lastError: string | null;
  }): Promise<void>;
  setPending(count: number): Promise<void>;
  markStored(key: string, hash: string, at: string): Promise<void>;
  loadSourceDocs(): Promise<SourceDoc[]>;
  activeLocales(): Promise<LocaleConfig[]>;
  crowdin: CrowdinPort;
  storeTranslation(input: {
    code: string;
    sourceId: string;
    hash: string;
    strings: StringMap;
    at: string;
  }): Promise<void>;
  revalidate(): Promise<void>;
};

export type SyncResult = { skipped?: "already-running"; pushed: string[]; stored: string[] };

const STALE_LOCK_MS = 10 * 60 * 1000;

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const status = await deps.readStatus();
  const startedMs = status.runStartedAt ? Date.parse(status.runStartedAt) : 0;
  const lockIsFresh = status.running && deps.now().getTime() - startedMs < STALE_LOCK_MS;
  if (lockIsFresh || !(await deps.tryStart(status.rev, deps.now().toISOString()))) {
    return { skipped: "already-running", pushed: [], stored: [] };
  }

  const pushed: string[] = [];
  const storedKeys: string[] = [];
  try {
    const [sources, locales] = await Promise.all([deps.loadSourceDocs(), deps.activeLocales()]);

    // 1. Push changed documents.
    const documents: SyncDocuments = { ...status.documents };
    const changedFileIds: number[] = [];
    for (const { id, doc } of sources) {
      const strings = extractStrings(doc);
      const hash = await hashStrings(strings);
      const previous = documents[id];
      if (previous?.hash === hash) continue;
      const fileId = await deps.crowdin.upsertFile({
        name: `${id}.json`,
        content: JSON.stringify(strings, null, 2),
        fileId: previous?.fileId,
      });
      documents[id] = { hash, fileId };
      pushed.push(id);
      changedFileIds.push(fileId);
    }

    // 2. Record the file ids before translation starts, so a Crowdin webhook that fires soon after can find them.
    if (pushed.length > 0) await deps.saveDocuments(documents);

    // 3. Machine-translate the changed files for the languages that are switched on.
    if (changedFileIds.length > 0 && locales.length > 0) {
      await deps.crowdin.preTranslate({
        fileIds: changedFileIds,
        languageIds: locales.map((l) => l.crowdinId),
      });
    }

    // 4. Pull whatever is already complete and not yet stored for the current hash.
    for (const [sourceId, { hash, fileId }] of Object.entries(documents)) {
      if (locales.every((l) => status.stored[storeKey(l.code, sourceId)] === hash)) continue;
      const progress = await deps.crowdin.getProgress(fileId);
      for (const locale of locales) {
        const key = storeKey(locale.code, sourceId);
        if (status.stored[key] === hash) continue;
        const row = progress.find((entry) => entry.languageId === locale.crowdinId);
        if (!row || row.translationProgress < 100) continue;
        const strings = await deps.crowdin.downloadTranslation(fileId, locale.crowdinId);
        const at = deps.now().toISOString();
        await deps.storeTranslation({ code: locale.code, sourceId, hash, strings, at });
        await deps.markStored(key, hash, at);
        storedKeys.push(key);
      }
    }

    if (storedKeys.length > 0) await deps.revalidate();
    await deps.finish({
      documents,
      lastSyncAt: deps.now().toISOString(),
      pendingCount: 0,
      lastError: null,
    });
    return { pushed, stored: storedKeys };
  } catch (error) {
    // Revert to the previous documents so the next press pushes and pre-translates again; the site keeps
    // serving whatever translations were already stored.
    await deps.finish({
      documents: status.documents,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type FileEventResult = {
  ignored?: "unknown-file" | "inactive-language" | "incomplete";
  stored?: string;
};

// Crowdin says a file is translated (or approved) for a language: pull it if it is really complete.
export async function handleFileEvent(
  deps: SyncDeps,
  event: { fileId: number; languageId: string },
): Promise<FileEventResult> {
  const status = await deps.readStatus();
  const entry = Object.entries(status.documents).find(([, doc]) => doc.fileId === event.fileId);
  if (!entry) return { ignored: "unknown-file" };
  const locale = (await deps.activeLocales()).find(
    (candidate) => candidate.crowdinId === event.languageId,
  );
  if (!locale) return { ignored: "inactive-language" };

  const [sourceId, { hash }] = entry;
  const progress = await deps.crowdin.getProgress(event.fileId);
  const row = progress.find((candidate) => candidate.languageId === event.languageId);
  if (!row || row.translationProgress < 100) return { ignored: "incomplete" };

  const strings = await deps.crowdin.downloadTranslation(event.fileId, event.languageId);
  const at = deps.now().toISOString();
  const key = storeKey(locale.code, sourceId);
  await deps.storeTranslation({ code: locale.code, sourceId, hash, strings, at });
  await deps.markStored(key, hash, at);
  await deps.revalidate();
  return { stored: key };
}

// How many source documents have changed since the last push (shown in the Studio next to the button).
export async function computePending(
  deps: Pick<SyncDeps, "readStatus" | "loadSourceDocs">,
): Promise<number> {
  const [status, sources] = await Promise.all([deps.readStatus(), deps.loadSourceDocs()]);
  let pending = 0;
  for (const { id, doc } of sources) {
    const hash = await hashStrings(extractStrings(doc));
    if (status.documents[id]?.hash !== hash) pending += 1;
  }
  return pending;
}
