import Image from "next/image";
import { getTranslations } from "next-intl/server";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";

const values = ["accessibility", "empathy", "education", "dataSovereignty"] as const;

export default async function Values() {
  const t = await getTranslations("home.values");

  return (
    <Section top="sm" bottom="md">
      <SectionHeader
        label={t("label")}
        title={t("title")}
        size="h4"
        spacing="tight"
        className="animate-on-scroll mb-14 md:mb-20"
      />

      <div className="grid grid-cols-1 gap-8 md:gap-12 lg:grid-cols-2 lg:gap-[132px]">
        <div className="animate-on-scroll relative h-[362px] overflow-hidden rounded-card border border-brand-purple/16 lg:h-auto">
          <Image
            src="/images/values/study-kit.webp"
            quality={90}
            alt={t("imageAlt")}
            fill
            sizes="(min-width: 992px) 622px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="border-t border-brand-purple/16">
          {values.map((key) => (
            <div
              key={key}
              className="animate-on-scroll grid grid-cols-1 gap-3 border-b border-brand-purple/16 py-4 md:grid-cols-2 md:gap-4 md:py-6"
            >
              <div className="font-medium text-brand-purple">{t(`items.${key}.title`)}</div>
              <div className="text-brand-purple">{t(`items.${key}.description`)}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
