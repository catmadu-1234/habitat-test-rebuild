import { assertFound } from "./assert-found";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { localize } from "./localize";
import { sanityFetch } from "./live";

// Fetch a section or list; fail loudly (with a Studio hint) if the dataset is missing it.
export async function fetchRequired<const Query extends string>(query: Query) {
  const { data } = await sanityFetch({ query, tags: [SANITY_CACHE_TAG] });
  return assertFound(data, query);
}

// English content from Sanity with translations for `locale` merged in. `path` is where the queried
// sub-tree sits inside the source document (e.g. "hero"), so keys line up with the extractor's.
export async function fetchLocalized<const Query extends string>(
  query: Query,
  locale: string,
  sourceId: string,
  path = "",
) {
  return localize(await fetchRequired(query), locale, sourceId, path);
}
