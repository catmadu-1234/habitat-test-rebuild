import type { Metadata } from "next";
import SiteShell from "@/components/layout/SiteShell";
import { statusFor } from "@/lib/languages";
import { NON_DEFAULT_LOCALES } from "@/lib/locales";
import { buildMetadata } from "@/sanity/lib/build-metadata";
import { client } from "@/sanity/lib/client";
import { requireAvailableLocale } from "@/sanity/lib/languages";
import { SITE_LANGUAGES_QUERY } from "@/sanity/queries";
import "../globals.css";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

// Pre-render the languages that are visible now; one switched on later renders on first request.
// Uses the plain client: sanityFetch reads draftMode(), which is not available at build time.
export async function generateStaticParams() {
  const rows = await client.fetch(SITE_LANGUAGES_QUERY);
  return NON_DEFAULT_LOCALES.filter((locale) => statusFor(rows, locale.code) !== "off").map(
    (locale) => ({ locale: locale.code }),
  );
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return buildMetadata(locale);
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
