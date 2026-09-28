import { after, type NextRequest, NextResponse } from "next/server";
import { computePending } from "@/lib/crowdin/sync";
import { createSyncDeps } from "@/sanity/lib/crowdin-deps";
import { verifySanityWebhook } from "@/sanity/lib/webhook";

// Called by a Sanity webhook on publish of homePage, siteSettings or post: refreshes the "N documents changed"
// counter in the Studio. Does not talk to Crowdin.
export async function POST(request: NextRequest) {
  const rejected = await verifySanityWebhook(request, true);
  if (rejected) return rejected;

  after(async () => {
    try {
      const deps = createSyncDeps();
      await deps.setPending(await computePending(deps));
    } catch (error) {
      console.error("crowdin pending count failed", error);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
