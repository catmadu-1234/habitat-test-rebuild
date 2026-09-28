import HomePage from "@/components/home/HomePage";
import { requireAvailableLocale } from "@/sanity/lib/languages";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAvailableLocale(locale);
  return <HomePage locale={locale} />;
}
