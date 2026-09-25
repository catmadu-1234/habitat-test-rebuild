import { cache } from "react";
import { applyTranslations, parseStrings, type StringMap } from "@/lib/crowdin/extract";
import { translationId } from "@/lib/crowdin/ids";
import { DEFAULT_LOCALE } from "@/lib/locales";
import { TRANSLATION_JSON_QUERY } from "@/sanity/queries";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { sanityFetch } from "./live";

const getStrings = cache(async (locale: string, sourceId: string): Promise<StringMap | null> => {
  const { data } = await sanityFetch({
    query: TRANSLATION_JSON_QUERY,
    params: { id: translationId(locale, sourceId) },
    tags: [SANITY_CACHE_TAG],
    stega: false,
  });
  return parseStrings(data);
});

// Swap translated strings into English data. English (or a missing/corrupt translation) is returned untouched.
export async function localize<T>(
  data: T,
  locale: string,
  sourceId: string,
  path = "",
): Promise<T> {
  if (locale === DEFAULT_LOCALE) return data;
  const strings = await getStrings(locale, sourceId);
  return strings ? applyTranslations(data, strings, path) : data;
}

// For lists of documents (e.g. blog posts), each translated by its own _id.
export function localizeDocs<T extends { _id: string }>(docs: T[], locale: string): Promise<T[]> {
  return Promise.all(docs.map((doc) => localize(doc, locale, doc._id)));
}
