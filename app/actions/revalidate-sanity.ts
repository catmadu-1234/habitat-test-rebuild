"use server";

import { draftMode } from "next/headers";
import { revalidateTag } from "next/cache";
import { parseTags } from "next-sanity/live";

// Called by <SanityLive /> when Sanity reports a change. Unlike the package's default
// (stale-while-revalidate, "max"), this expires the tags immediately so the next request
// renders fresh content; the default did not refresh pages on Cloudflare Workers.
export async function revalidateSanityTags(unsafeTags: unknown): Promise<"refresh"> {
  // Draft Mode bypasses the cache, so just refresh the router.
  if ((await draftMode()).isEnabled) return "refresh";

  const { tags } = parseTags(unsafeTags);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return "refresh";
}
