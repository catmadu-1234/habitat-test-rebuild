import { assertFound } from "./assert-found";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { sanityFetch } from "./live";

// Fetch a section or list; fail loudly (with a Studio hint) if the dataset is missing it.
export async function fetchRequired<const Query extends string>(query: Query) {
  const { data } = await sanityFetch({ query, tags: [SANITY_CACHE_TAG] });
  return assertFound(data, query);
}
