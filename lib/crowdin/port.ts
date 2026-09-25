import type { StringMap } from "./extract.ts";

export type CrowdinPort = {
  upsertFile(args: { name: string; content: string; fileId?: number }): Promise<number>;
  preTranslate(args: { fileIds: number[]; languageIds: string[] }): Promise<void>;
  getProgress(fileId: number): Promise<{ languageId: string; translationProgress: number }[]>;
  downloadTranslation(fileId: number, languageId: string): Promise<StringMap>;
};

export type CrowdinConfig = {
  token: string;
  projectId: number;
  /** Crowdin Enterprise uses https://<org>.api.crowdin.com/api/v2 */
  baseUrl?: string;
  method: "tm" | "mt" | "ai";
  engineId?: number;
  aiPromptId?: number;
  fetchImpl?: typeof fetch;
};

export function createCrowdinPort(config: CrowdinConfig): CrowdinPort {
  const base = config.baseUrl ?? "https://api.crowdin.com/api/v2";
  const doFetch = config.fetchImpl ?? fetch;
  const project = `/projects/${config.projectId}`;

  async function call<T>(
    path: string,
    method: string,
    headers: Record<string, string> = {},
    body?: string,
  ): Promise<T> {
    const response = await doFetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}`, ...headers },
      body,
    });
    if (!response.ok) {
      throw new Error(
        `Crowdin ${method} ${path} failed: ${response.status} ${(await response.text()).slice(0, 300)}`,
      );
    }
    return (await response.json()) as T;
  }

  const jsonHeaders = { "Content-Type": "application/json" };

  async function addStorage(name: string, content: string): Promise<number> {
    const result = await call<{ data: { id: number } }>(
      "/storages",
      "POST",
      { "Crowdin-API-FileName": name, "Content-Type": "application/octet-stream" },
      content,
    );
    return result.data.id;
  }

  async function findFileId(name: string): Promise<number | undefined> {
    const result = await call<{ data: { data: { id: number; name: string } }[] }>(
      `${project}/files?limit=500`,
      "GET",
    );
    return result.data.find((entry) => entry.data.name === name)?.data.id;
  }

  return {
    async upsertFile({ name, content, fileId }) {
      const storageId = await addStorage(name, content);
      const existing = fileId ?? (await findFileId(name));
      if (existing !== undefined) {
        await call(
          `${project}/files/${existing}`,
          "PUT",
          jsonHeaders,
          // Changed strings lose their old translation (it would be wrong for the new sentence) and get re-translated;
          // unchanged strings keep theirs.
          JSON.stringify({ storageId, updateOption: "clear_translations_and_approvals" }),
        );
        return existing;
      }
      const created = await call<{ data: { id: number } }>(
        `${project}/files`,
        "POST",
        jsonHeaders,
        JSON.stringify({ storageId, name, type: "json" }),
      );
      return created.data.id;
    },

    async preTranslate({ fileIds, languageIds }) {
      await call(
        `${project}/pre-translations`,
        "POST",
        jsonHeaders,
        JSON.stringify({
          languageIds,
          fileIds,
          method: config.method,
          ...(config.engineId !== undefined ? { engineId: config.engineId } : {}),
          ...(config.aiPromptId !== undefined ? { aiPromptId: config.aiPromptId } : {}),
          scope: "untranslated",
        }),
      );
    },

    async getProgress(fileId) {
      const result = await call<{
        data: { data: { languageId: string; translationProgress: number } }[];
      }>(`${project}/files/${fileId}/languages/progress?limit=100`, "GET");
      return result.data.map((row) => ({
        languageId: row.data.languageId,
        translationProgress: row.data.translationProgress,
      }));
    },

    async downloadTranslation(fileId, languageId) {
      const build = await call<{ data: { url: string } }>(
        `${project}/translations/builds/files/${fileId}`,
        "POST",
        jsonHeaders,
        JSON.stringify({ targetLanguageId: languageId }),
      );
      // The download URL is pre-signed: no Authorization header.
      const response = await doFetch(build.data.url);
      if (!response.ok) throw new Error(`Crowdin download failed: ${response.status}`);
      const parsed = (await response.json()) as Record<string, unknown>;
      const map: StringMap = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === "object") {
          throw new Error(
            `Crowdin returned nested JSON for "${key}"; expected a flat key/value file`,
          );
        }
        if (typeof value === "string") map[key] = value;
      }
      return map;
    },
  };
}
