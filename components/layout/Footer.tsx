import Image from "next/image";
import { getTranslations } from "next-intl/server";
import Label from "@/components/ui/Label";
import { links } from "@/lib/links";

// [translation key, href] per column. Copy lives in locales/en/common.json (footer.*).
const columns = [
  {
    key: "login",
    items: [
      ["messengerPigeon", links.messengerPigeonLogin],
      ["admin", links.adminLogin],
    ],
  },
  {
    key: "company",
    items: [
      ["about", links.about],
      ["careers", links.careers],
      ["security", links.security],
      ["download", links.messengerPigeonDownload],
    ],
  },
  {
    key: "resources",
    items: [
      ["help", links.help],
      ["blog", links.blog],
      ["grants", links.grants],
      ["bookCall", links.contact],
      ["partners", links.partners],
    ],
  },
  {
    key: "more",
    items: [
      ["privacy", links.privacy],
      ["securityAi", links.securityAi],
      ["terms", links.terms],
      ["accessibility", links.accessibility],
    ],
  },
] as const;

const social = [
  ["youtube", links.youtube],
  ["linkedin", links.linkedin],
  ["instagram", links.instagram],
  ["tiktok", links.tiktok],
] as const;

export default async function Footer() {
  const t = await getTranslations("common.footer");

  return (
    <footer className="relative z-[1] bg-brand-green pb-4 pt-12 text-paper/88 md:pb-8 md:pt-20">
      <div className="mx-auto flex max-w-page flex-col gap-10 px-page pb-10 md:gap-content">
        <div className="grid grid-cols-1 gap-12 md:gap-16 lg:grid-cols-2">
          <a href={links.home} className="block w-[136px] md:w-[170px]">
            <Image
              src="/images/logos/habitat-learn-logo-white.png"
              alt={t("logoAlt")}
              width={1975}
              height={907}
              className="h-auto w-full"
            />
          </a>

          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-4">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-4 md:gap-5">
                <Label size="sm" className="text-paper/64">
                  {t(`columns.${column.key}.label`)}
                </Label>
                <div className="flex flex-col">
                  {column.items.map(([key, href]) => (
                    <a key={key} href={href} className="transition-opacity hover:opacity-70">
                      {t(`columns.${column.key}.items.${key}`)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-paper/16 pb-6 pt-8 md:gap-8 md:pb-8 md:pt-12">
          <div className="flex items-center gap-3 md:gap-4">
            {social.map(([key, href]) => (
              <a
                key={key}
                href={href}
                className="block h-3 w-3 transition-opacity hover:opacity-50 md:h-4 md:w-4"
              >
                <Image
                  src={`/images/icons/${key}.svg`}
                  alt={t(`social.${key}`)}
                  width={16}
                  height={16}
                  className="h-full w-full"
                  unoptimized
                />
              </a>
            ))}
          </div>
          <Label size="sm" className="text-paper/64">
            {t("copyright")}
          </Label>
        </div>
      </div>
    </footer>
  );
}
