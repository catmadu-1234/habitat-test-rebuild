import Image from "next/image";
import { getTranslations } from "next-intl/server";
import BackgroundVideo from "@/components/ui/BackgroundVideo";
import Button from "@/components/ui/Button";
import Label from "@/components/ui/Label";
import Section from "@/components/ui/Section";
import SectionLabel from "@/components/ui/SectionLabel";
import { CheckCircleIcon, MailIcon } from "@/components/ui/Icons";
import { links } from "@/lib/links";

const avatars = [
  ["csuci", "/images/logos/avatar-csuci.png"],
  ["berkeley", "/images/logos/avatar-berkeley.webp"],
  ["toronto", "/images/logos/avatar-toronto.png"],
  ["harvard", "/images/logos/avatar-harvard.webp"],
  ["ivyTech", "/images/logos/avatar-ivy-tech.webp"],
  ["humber", "/images/logos/avatar-humber.png"],
] as const;

export default async function Hero() {
  const t = await getTranslations("home.hero");

  return (
    <Section top="lg">
      {/* Headline */}
      <div className="mx-auto mb-8 flex max-w-headline flex-col items-center gap-4 text-center text-brand-purple md:mb-12 md:gap-6">
        <SectionLabel className="ml-[5px]">{t("label")}</SectionLabel>
        <h1 className="font-heading text-h1">{t("title")}</h1>
        <p className="mb-2.5 max-w-[450px] text-brand-purple/64">{t("description")}</p>
        <div className="flex items-center justify-center gap-2.5">
          <Button href={links.contact} withArrow>
            {t("primaryCta")}
          </Button>
          <Button href={links.contact} variant="secondary" className="hidden md:flex">
            {t("secondaryCta")}
          </Button>
        </div>
      </div>

      {/* Social proof */}
      <div className="mb-12 flex flex-col items-center gap-3 md:mb-16 md:gap-4">
        <div className="flex">
          {avatars.map(([key, src], index) => (
            <div
              key={key}
              className={`relative h-10 w-10 flex-none overflow-hidden rounded-full border-2 border-paper md:h-12 md:w-12 ${index > 0 ? "-ml-4" : ""}`}
            >
              <Image
                src={src}
                alt={t(`avatars.${key}`)}
                fill
                sizes="(min-width: 768px) 48px, 40px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <div className="text-body-sm text-brand-purple/64">{t("trustedBy")}</div>
      </div>

      {/* Media grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_10fr] md:gap-4">
        <div className="relative h-[360px] overflow-hidden rounded-card md:h-full">
          <BackgroundVideo
            src="/video/hero.webm"
            poster="/images/hero/hero-video-poster.jpg"
            pauseLabel={t("pauseVideo")}
            playLabel={t("playVideo")}
          />
        </div>

        <div className="grid grid-cols-1 grid-rows-[165px_165px] gap-3 md:h-[570px] md:grid-cols-2 md:grid-rows-2 md:gap-4 lg:h-auto lg:grid-cols-[1.25fr_1fr]">
          <div className="relative overflow-hidden rounded-card md:col-span-2 lg:col-span-1">
            <Image
              src="/images/hero/team-study-session.webp"
              quality={90}
              alt={t("teamImageAlt")}
              fill
              sizes="(min-width: 992px) 436px, (min-width: 768px) 435px, 358px"
              className="object-cover"
            />
          </div>

          <div className="hidden aspect-square items-center justify-center overflow-hidden rounded-card bg-lift p-6 text-brand-purple lg:flex">
            <Image
              src="/images/hero/grow.png"
              alt=""
              width={300}
              height={300}
              className="block h-auto max-w-full"
            />
          </div>

          <div className="flex items-center justify-center rounded-card bg-brand-purple p-6 text-paper/88 md:col-span-2 md:p-16">
            <div className="flex w-full max-w-widget flex-col gap-2.5">
              <div className="flex flex-col gap-3 rounded-card border border-brand-purple/16 bg-paper p-3 text-brand-purple/88 md:gap-4 md:p-4">
                <div className="flex items-center gap-4">
                  <MailIcon className="h-3 w-3 flex-none text-brand-purple/64 md:h-4 md:w-4" />
                  <Label>{t("followUp.title")}</Label>
                </div>
                <div className="h-px w-full bg-brand-purple/16" />
                <div className="text-body-sm text-brand-purple">{t("followUp.message")}</div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircleIcon className="h-3 w-3 flex-none text-paper/64 md:h-4 md:w-4" />
                  <Label size="sm" className="text-paper/64">
                    {t("followUp.sentBy")}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
