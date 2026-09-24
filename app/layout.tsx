import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import Footer from "@/components/layout/Footer";
import Nav from "@/components/layout/Nav";
import DisableDraftMode from "@/components/ui/DisableDraftMode";
import type { SanityImageSource } from "@sanity/image-url";
import { revalidateSanityTags } from "@/app/actions/revalidate-sanity";
import { SANITY_CACHE_TAG } from "@/sanity/lib/cache-tag";
import { urlFor } from "@/sanity/lib/image";
import { SanityLive, sanityFetch } from "@/sanity/lib/live";
import { SITE_META_QUERY } from "@/sanity/queries";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-manrope",
  display: "swap",
});

// PP Woodland (Pangram Pangram), licensed; only the Regular weight is used on the homepage.
const woodland = localFont({
  src: "./fonts/PPWoodland-Regular.woff2",
  weight: "400",
  variable: "--font-woodland",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // stega must be off here: invisible characters must never reach <head>.
  const { data: meta } = await sanityFetch({
    query: SITE_META_QUERY,
    stega: false,
    tags: [SANITY_CACHE_TAG],
  });
  if (!meta) throw new Error("No siteSettings meta found. Create the document in the Studio.");
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <html lang="en" className={`${manrope.variable} ${woodland.variable}`}>
      <body className="bg-paper font-body text-body text-brand-purple/88 antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
        <SanityLive action={revalidateSanityTags} />
        {isDraftMode && (
          <>
            <DisableDraftMode />
            <VisualEditing />
          </>
        )}
      </body>
    </html>
  );
}
