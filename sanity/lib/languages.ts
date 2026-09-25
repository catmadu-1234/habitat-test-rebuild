import { cache } from "react";
import { notFound } from "next/navigation";
import { stegaClean } from "next-sanity";
import { statusFor, type LanguageStatus } from "@/lib/languages";
import { DEFAULT_LOCALE, getLocale, type LocaleConfig } from "@/lib/locales";
import { SITE_LANGUAGES_QUERY } from "@/sanity/queries";
import { SANITY_CACHE_TAG } from "./cache-tag";
import { sanityFetch } from "./live";

export const getLanguages = cache(async () => {
  // Not fetchRequired: English must keep rendering when `languages` is missing. No rows means no
  // switcher and 404s for every other locale.
  const { data } = await sanityFetch({ query: SITE_LANGUAGES_QUERY, tags: [SANITY_CACHE_TAG] });
  const rows = data ?? [];
  // Codes and statuses drive logic, so strip stega. Names are visible text and stay as they are.
  return rows.map((row) => ({
    ...row,
    code: stegaClean(row.code),
    status: stegaClean(row.status),
  }));
});

// 404 for "/en" (English lives at "/"), unknown codes, and languages that are off.
export async function requireAvailableLocale(
  code: string,
): Promise<{ locale: LocaleConfig; status: LanguageStatus }> {
  const locale = getLocale(code);
  if (!locale || code === DEFAULT_LOCALE) notFound();
  const status = statusFor(await getLanguages(), code);
  if (status === "off") notFound();
  return { locale, status };
}
