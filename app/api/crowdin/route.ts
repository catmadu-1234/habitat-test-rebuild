import { after, type NextRequest, NextResponse } from "next/server";
import { handleFileEvent } from "@/lib/crowdin/sync";
import { isAuthorized, parseFileEvents } from "@/lib/crowdin/webhook";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";

// Crowdin project webhook (events: file.translated, file.approved). Authenticated with a custom header.
// Once authenticated this always answers 2xx, because Crowdin retries on errors; problems are logged instead.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request.headers.get("x-webhook-secret"), process.env.CROWDIN_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: 0 });
  }

  const events = parseFileEvents(body);
  after(async () => {
    const deps = createSyncDeps();
    for (const event of events) {
      try {
        console.log(
          "crowdin event",
          JSON.stringify({ ...event, ...(await handleFileEvent(deps, event)) }),
        );
      } catch (error) {
        console.error("crowdin event failed", event, error);
      }
    }
  });
  return NextResponse.json({ received: events.length });
}
