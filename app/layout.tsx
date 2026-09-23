import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import { getLocale, getTranslations } from "next-intl/server";
import Footer from "@/components/layout/Footer";
import Nav from "@/components/layout/Nav";
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
  const t = await getTranslations("common.meta");
  return {
    // Vercel exposes the production domain; fall back to localhost in dev.
    metadataBase: new URL(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000",
    ),
    title: t("title"),
    description: t("description"),
    openGraph: {
      type: "website",
      title: t("title"),
      description: t("description"),
      images: ["/images/og-image.jpg"],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/images/og-image.jpg"],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${manrope.variable} ${woodland.variable}`}>
      <body className="bg-paper font-body text-body text-brand-purple/88 antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
