import type { MetadataRoute } from "next";
import { statusFor } from "@/lib/languages";
import { LOCALES, localePath } from "@/lib/locales";
import { SITE_URL } from "@/lib/site-url";
import { client } from "@/sanity/lib/client";
import { SITE_LANGUAGES_QUERY } from "@/sanity/queries";

// Re-generated at most hourly so a language switched to live in Studio shows up without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Plain client: sanityFetch reads draftMode(), which is not available when the sitemap is built.
  const rows = await client.fetch(SITE_LANGUAGES_QUERY);
  const live = LOCALES.filter((locale) => statusFor(rows, locale.code) === "live");
  const languages = Object.fromEntries(
    live.map((locale) => [locale.htmlLang, `${SITE_URL}${localePath(locale.code)}`]),
  );
  return live.map((locale) => ({
    url: `${SITE_URL}${localePath(locale.code)}`,
    alternates: { languages },
  }));
}
