import { after, type NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/crowdin/sync";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";
import { verifySanityWebhook } from "@/sanity/lib/webhook";

// Called by a Sanity webhook when an editor presses "Translate all changes" in the Studio
// (translationStatus.requestedAt changed). Sanity only lets people who can write documents do that.
export async function POST(request: NextRequest) {
  const rejected = await verifySanityWebhook(request, false);
  if (rejected) return rejected;

  // Sanity gives webhooks about 30 seconds; the sync can take longer, so answer now and finish afterwards.
  after(async () => {
    try {
      console.log("crowdin sync", JSON.stringify(await runSync(createSyncDeps())));
    } catch (error) {
      console.error("crowdin sync failed", error);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
