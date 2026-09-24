import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { SANITY_CACHE_TAG } from "@/sanity/lib/cache-tag";

// Called by a Sanity webhook on publish. Unlike <SanityLive />, it works when no visitor has the site
// open, which is the case when an editor publishes from Presentation (their browser is in Draft Mode).
export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) {
    return new Response("SANITY_REVALIDATE_SECRET is not set", { status: 500 });
  }

  // Also waits briefly for Sanity's CDN to catch up so the re-render sees the new content.
  const { isValidSignature } = await parseBody(request, secret, true);
  if (!isValidSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  revalidateTag(SANITY_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ revalidated: SANITY_CACHE_TAG });
}
