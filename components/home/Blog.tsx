import Image from "next/image";
import { getTranslations } from "next-intl/server";
import Label from "@/components/ui/Label";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowLargeIcon } from "@/components/ui/Icons";
import { links } from "@/lib/links";

// Static snapshot of the live CMS blog cards; copy lives in locales/en/home.json.
const posts = [
  {
    key: "messengerPigeonV2",
    href: links.blogPosts.messengerPigeonV2,
    image: "/images/blog/messenger-pigeon-v2.jpg",
  },
  { key: "ottawa", href: links.blogPosts.ottawa, image: "/images/blog/university-of-ottawa.jpg" },
  { key: "wcag", href: links.blogPosts.wcag, image: "/images/blog/wcag-compliance.jpg" },
] as const;

export default async function Blog() {
  const t = await getTranslations("home.blog");

  return (
    <Section top="md">
      <SectionHeader
        label={t("label")}
        title={t("title")}
        size="h3"
        className="animate-on-scroll mb-12 md:mb-16"
      />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-x-4 md:gap-y-8">
        {posts.map(({ key, href, image }) => (
          <a
            key={key}
            href={href}
            className="animate-on-scroll flex flex-col gap-3 text-brand-purple md:gap-4"
          >
            <div className="relative h-[300px] overflow-hidden rounded-card md:h-[340px]">
              <Image
                src={image}
                quality={90}
                alt={t(`posts.${key}.imageAlt`)}
                fill
                sizes="(min-width: 768px) 448px, 358px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="flex items-center justify-between text-brand-purple/88">
                <Label>{t(`posts.${key}.category`)}</Label>
                <Label>{t(`posts.${key}.date`)}</Label>
              </div>
              <div className="font-heading text-h6">{t(`posts.${key}.title`)}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 flex justify-center md:mt-16">
        <a
          href={links.blog}
          aria-label={t("nextPage")}
          className="m-px flex items-center justify-center rounded-pill border border-brand-purple/16 px-3 py-2.5 text-brand-purple shadow-button backdrop-blur-[10px] transition-colors hover:border-paper/8 hover:bg-brand-purple/88 hover:text-paper md:px-4 md:py-3"
        >
          <ArrowLargeIcon className="h-5 w-5 md:h-6 md:w-6" />
        </a>
      </div>
    </Section>
  );
}
