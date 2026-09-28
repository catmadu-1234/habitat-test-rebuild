import { draftMode } from "next/headers";
import { VisualEditing } from "next-sanity/visual-editing";
import { revalidateSanityTags } from "@/app/actions/revalidate-sanity";
import { manrope, woodland } from "@/app/fonts";
import DisableDraftMode from "@/components/ui/DisableDraftMode";
import { getLocale } from "@/lib/locales";
import { SanityLive } from "@/sanity/lib/live";
import Footer from "./Footer";
import Nav from "./Nav";

export default async function SiteShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const config = getLocale(locale);
  if (!config) throw new Error(`Unknown locale: ${locale}`);
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <html
      lang={config.htmlLang}
      dir={config.dir}
      className={`${manrope.variable} ${woodland.variable}`}
    >
      <body className="bg-paper font-body text-body text-brand-purple/88 antialiased">
        <Nav locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
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
