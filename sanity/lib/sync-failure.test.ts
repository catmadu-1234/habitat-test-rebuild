import assert from "node:assert/strict";
import { test } from "node:test";
import { recordSyncFailure } from "./sync-failure.ts";

function fakeClient() {
  const calls: { created?: unknown; patched?: unknown; set?: unknown } = {};
  const client = {
    createIfNotExists: async (doc: unknown) => {
      calls.created = doc;
    },
    patch: (id: unknown) => {
      calls.patched = id;
      return {
        set: (fields: unknown) => {
          calls.set = fields;
          return { commit: async () => ({}) };
        },
      };
    },
  };
  return { client, calls };
}

test("writes running false and the error message to translationStatus", async () => {
  const { client, calls } = fakeClient();
  await recordSyncFailure(new Error("CROWDIN_API_TOKEN is not set"), () => client as never);
  assert.deepEqual(calls.created, { _id: "translationStatus", _type: "translationStatus" });
  assert.equal(calls.patched, "translationStatus");
  assert.deepEqual(calls.set, { running: false, lastError: "CROWDIN_API_TOKEN is not set" });
});

test("never throws when the write client is unavailable", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await recordSyncFailure("boom", () => {
      throw new Error("SANITY_API_WRITE_TOKEN is not set");
    });
  } finally {
    console.error = original;
  }
});
