import type { Metadata } from "next";
import type { SanityImageSource } from "@sanity/image-url";
import { SANITY_CACHE_TAG } from "@/sanity/lib/cache-tag";
import { urlFor } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";
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

  return {
    // Vercel exposes the production domain; fall back to localhost in dev.
    metadataBase: new URL(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000",
    ),
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
