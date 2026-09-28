import { timingSafeEqual } from "node:crypto";

export function isAuthorized(
  received: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type FileEvent = { fileId: number; languageId: string };

// Crowdin sends one event per request, or {events: [...]} when batching is on.
export function parseFileEvents(body: unknown): FileEvent[] {
  const batched =
    body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events);
  const items: unknown[] = batched ? (body as { events: unknown[] }).events : [body];
  const events: FileEvent[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const event = item as {
      event?: unknown;
      file?: { id?: unknown };
      targetLanguage?: { id?: unknown };
    };
    if (event.event !== "file.translated" && event.event !== "file.approved") continue;
    const fileId = Number(event.file?.id);
    const languageId = event.targetLanguage?.id;
    if (!Number.isInteger(fileId) || typeof languageId !== "string") continue;
    events.push({ fileId, languageId });
  }
  return events;
}
