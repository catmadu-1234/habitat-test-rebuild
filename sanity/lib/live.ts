import { defineLive } from "next-sanity/live";
import { readToken } from "@/sanity/env";
import { client } from "./client";

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: readToken,
  browserToken: readToken,
});
