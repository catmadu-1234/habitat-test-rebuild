import type { Metadata } from "next";
import type { SanityImageSource } from "@sanity/image-url";
import { statusFor } from "@/lib/languages";
import { LOCALES, DEFAULT_LOCALE, localePath } from "@/lib/locales";
import { SITE_URL } from "@/lib/site-url";
import { SANITY_CACHE_TAG } from "@/sanity/lib/cache-tag";
import { urlFor } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";
import { getLanguages } from "@/sanity/lib/languages";
import { localize } from "@/sanity/lib/localize";
import { SITE_META_QUERY } from "@/sanity/queries";

export async function buildMetadata(locale: string): Promise<Metadata> {
  // stega must be off here: invisible characters must never reach <head>.
  const { data } = await sanityFetch({
    query: SITE_META_QUERY,
    stega: false,
    tags: [SANITY_CACHE_TAG],
  });
  if (!data) throw new Error("No siteSettings meta found. Create the document in the Studio.");
  const meta = await localize(data, locale, "siteSettings-en", "meta");
  // Skip the image if an editor cleared the asset (urlFor throws on an asset-less image).
  const ogImage = meta.ogImage?.asset
    ? [urlFor(meta.ogImage as SanityImageSource).url()]
    : undefined;

  const rows = await getLanguages();
  const live = LOCALES.filter((entry) => statusFor(rows, entry.code) === "live");
  const alternates = {
    canonical: localePath(locale),
    languages: {
      "x-default": localePath(DEFAULT_LOCALE),
      ...Object.fromEntries(live.map((entry) => [entry.htmlLang, localePath(entry.code)])),
    },
  };
  // Machine-translated previews must not be indexed until someone flips them to Live.
  const robots =
    statusFor(rows, locale) === "preview" ? { index: false, follow: false } : undefined;

  return {
    metadataBase: new URL(SITE_URL),
    alternates,
    robots,
    title: meta.title,
    description: meta.description,
    openGraph: {
      type: "website",
      title: meta.title,
      description: meta.description,
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ogImage,
    },
  };
}
