import { cache } from "react";
import { notFound } from "next/navigation";
import { stegaClean } from "next-sanity";
import { statusFor, type LanguageStatus } from "@/lib/languages";
import { DEFAULT_LOCALE, getLocale, type LocaleConfig } from "@/lib/locales";
import { SITE_LANGUAGES_QUERY } from "@/sanity/queries";
import { fetchRequired } from "./fetch";

export const getLanguages = cache(async () => {
  const rows = await fetchRequired(SITE_LANGUAGES_QUERY);
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
