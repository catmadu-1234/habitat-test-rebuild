import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { readToken } from "@/sanity/env";
import { client } from "@/sanity/lib/client";

export async function GET(request: Request) {
  if (!readToken) {
    return new Response("SANITY_API_READ_TOKEN is not set", { status: 500 });
  }
  return defineEnableDraftMode({ client: client.withConfig({ token: readToken }) }).GET(request);
}
