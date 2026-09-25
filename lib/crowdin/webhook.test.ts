import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthorized, parseFileEvents } from "./webhook.ts";

test("isAuthorized accepts only the exact secret", () => {
  assert.equal(isAuthorized("s3cret", "s3cret"), true);
  assert.equal(isAuthorized("s3cret!", "s3cret"), false);
  assert.equal(isAuthorized("wrong", "s3cret"), false);
});

test("REVIEW: a missing header or a missing server secret is never authorized", () => {
  assert.equal(isAuthorized(null, "s3cret"), false);
  assert.equal(isAuthorized(undefined, "s3cret"), false);
  assert.equal(isAuthorized("", ""), false);
  assert.equal(isAuthorized("x", undefined), false);
});

test("parses a single file.translated event", () => {
  assert.deepEqual(
    parseFileEvents({
      event: "file.translated",
      file: { id: "44", project: { id: "7" } },
      targetLanguage: { id: "es" },
    }),
    [{ fileId: 44, languageId: "es" }],
  );
});

test("parses file.approved and batched events, ignoring other events and malformed items", () => {
  const body = {
    events: [
      { event: "file.approved", file: { id: 5 }, targetLanguage: { id: "ar" } },
      { event: "project.translated", file: { id: 6 }, targetLanguage: { id: "ar" } },
      { event: "file.translated", file: { id: "nope" }, targetLanguage: { id: "ar" } },
      { event: "file.translated", file: { id: 8 } },
      null,
      "text",
    ],
  };
  assert.deepEqual(parseFileEvents(body), [{ fileId: 5, languageId: "ar" }]);
});

test("garbage bodies produce no events", () => {
  assert.deepEqual(parseFileEvents(null), []);
  assert.deepEqual(parseFileEvents("x"), []);
  assert.deepEqual(parseFileEvents({}), []);
});
