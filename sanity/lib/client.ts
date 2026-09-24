import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId, studioUrl } from "@/sanity/env";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  // sanityFetch only turns stega (click-to-edit encoding) on while Draft Mode is active.
  stega: { studioUrl },
});
