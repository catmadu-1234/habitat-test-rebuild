import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

// Same mechanism as /api/revalidate. Returns a Response to send back if the request must be rejected, else null.
export async function verifySanityWebhook(
  request: NextRequest,
  waitForContentLakeEventualConsistency: boolean,
): Promise<Response | null> {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return new Response("SANITY_REVALIDATE_SECRET is not set", { status: 500 });
  const { isValidSignature } = await parseBody(
    request,
    secret,
    waitForContentLakeEventualConsistency,
  );
  return isValidSignature ? null : new Response("Invalid signature", { status: 401 });
}
