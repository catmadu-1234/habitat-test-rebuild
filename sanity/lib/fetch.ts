import { assertFound } from "./assert-found";
import { sanityFetch } from "./live";

// Fetch a singleton section; fail loudly (with a seed hint) if the dataset is missing it.
export async function fetchRequired<const Query extends string>(query: Query) {
  const { data } = await sanityFetch({ query });
  return assertFound(data, query);
}
