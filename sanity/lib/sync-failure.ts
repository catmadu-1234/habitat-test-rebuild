import type { getWriteClient } from "./write-client";

// Setup failures (for example a missing CROWDIN_* variable) happen before the sync engine can record
// them, so write them to the status document here for the Studio to show. Messages from requireEnv
// only name the variable, never its value. If the write itself fails, all we can do is log.
export async function recordSyncFailure(
  error: unknown,
  makeClient?: typeof getWriteClient,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    // Loaded lazily so the alias-heavy write client is only pulled in when a real write happens.
    const client = (makeClient ?? (await import("./write-client")).getWriteClient)();
    await client.createIfNotExists({ _id: "translationStatus", _type: "translationStatus" });
    await client.patch("translationStatus").set({ running: false, lastError: message }).commit();
  } catch (writeError) {
    console.error("could not record crowdin sync failure", writeError);
  }
}
