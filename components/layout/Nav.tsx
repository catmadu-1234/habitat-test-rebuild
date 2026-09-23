import Image from "next/image";
import { getTranslations } from "next-intl/server";
import Button from "@/components/ui/Button";
import SectionLabel from "@/components/ui/SectionLabel";
import PromoTile from "./PromoTile";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { links } from "@/lib/links";

// [translation key, href] pairs. Copy lives in locales/en/common.json (nav.*).
const orgColumns = [
  {
    key: "products",
    items: [
      ["messengerPigeon", links.messengerPigeon],
      ["podium", links.podium],
      ["liveServices", links.liveServices],
    ],
  },
  {
    key: "resources",
    items: [
      ["blog", links.blog],
      ["help", links.help],
      ["security", links.security],
    ],
  },
  {
    key: "start",
    items: [
      ["login", links.adminLogin],
      ["bookCall", links.bookCall],
    ],
  },
] as const;

const studentItems = [
  ["messengerPigeon", links.messengerPigeon],
  ["help", links.help],
  ["download", links.messengerPigeonDownload],
  ["helpAgain", links.help],
  ["login", links.messengerPigeonLogin],
] as const;

const mobileItems = [
  ["messengerPigeon", links.messengerPigeon],
  ["liveServices", links.liveServices],
  ["about", links.about],
  ["blog", links.blog],
  ["contact", links.contact],
  ["login", links.adminLogin],
] as const;

const navLink =
  "block rounded-button border border-transparent px-3 py-2.5 text-[16px] font-medium leading-4 text-brand-purple transition-colors hover:border-paper/8 hover:bg-brand-purple hover:text-paper";

// Full-width panel that drops below the nav bar while its `group/dd` parent is hovered or focused.
const dropdownPanel =
  "invisible fixed inset-x-0 top-[70px] z-10 pt-5 opacity-0 transition-opacity duration-200 group-hover/dd:visible group-hover/dd:opacity-100 group-focus-within/dd:visible group-focus-within/dd:opacity-100";

export default async function Nav() {
  const t = await getTranslations("common.nav");

  return (
    <header className="group/nav relative z-[999]">
      <div className="relative z-[3] bg-canvas py-4 transition-colors has-[.dd:hover]:bg-paper md:py-5">
        {/* Mobile menu toggle. Checked state is read with group-has-[...]. */}
        <input
          id="nav-toggle"
          type="checkbox"
          aria-label={t("openMenu")}
          className="peer sr-only"
        />

        <div className="relative z-[2] mx-auto flex max-w-page items-center justify-between px-8">
          <a href={links.home} className="block">
            <Image
              src="/images/logos/habitat-learn-logo-colour.png"
              alt={t("logoAlt")}
              width={573}
              height={264}
              priority
              className="h-auto w-[119px] md:w-[136px]"
            />
          </a>

          {/* Mobile / tablet menu button */}
          <label
            htmlFor="nav-toggle"
            className="relative flex h-7 w-8 cursor-pointer items-center justify-center rounded-pill border border-brand-purple/16 text-brand-purple shadow-button backdrop-blur-[10px] peer-focus-visible:outline lg:hidden"
          >
            <span className="sr-only">{t("openMenu")}</span>
            <MenuIcon className="h-3 w-3 group-has-[#nav-toggle:checked]/nav:hidden" />
            <CloseIcon className="hidden h-4 w-4 group-has-[#nav-toggle:checked]/nav:block" />
          </label>

          {/* Desktop links */}
          <nav className="hidden items-center lg:flex">
            <div className="dd group/dd">
              <div
                tabIndex={0}
                className={`cursor-pointer ${navLink} group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper`}
              >
                {t("organizations.label")}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto grid max-w-page grid-cols-4 gap-4 px-8">
                    <div className="col-span-3 grid grid-cols-3 gap-4">
                      {orgColumns.map((column) => (
                        <div key={column.key} className="flex flex-col items-start gap-8">
                          <SectionLabel className="ml-[5px]">
                            {t(`organizations.columns.${column.key}.label`)}
                          </SectionLabel>
                          <div className="flex flex-col items-start gap-4">
                            {column.items.map(([key, href]) => (
                              <a
                                key={key}
                                href={href}
                                className="flex max-w-full flex-col items-start text-brand-purple/88"
                              >
                                <div>
                                  {t(`organizations.columns.${column.key}.items.${key}.label`)}
                                </div>
                                <div className="text-body-sm text-brand-purple/64">
                                  {t(
                                    `organizations.columns.${column.key}.items.${key}.description`,
                                  )}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <PromoTile
                      className="h-[332px]"
                      media={
                        <Image
                          src="/images/nav/group-study-session.webp"
                          alt={t("organizations.promo.imageAlt")}
                          fill
                          sizes="332px"
                          className="object-cover"
                        />
                      }
                    >
                      <Button href={links.blog}>{t("organizations.promo.label")}</Button>
                    </PromoTile>
                  </div>
                </div>
              </div>
            </div>

            <div className="dd group/dd">
              <div
                tabIndex={0}
                className={`cursor-pointer ${navLink} group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper`}
              >
                {t("students.label")}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto flex max-w-page justify-between gap-6 px-8">
                    <div className="flex flex-col items-start gap-8">
                      <SectionLabel className="ml-[5px]">{t("students.columnLabel")}</SectionLabel>
                      <div className="flex flex-col items-start">
                        {studentItems.map(([key, href]) => (
                          <a key={key} href={href} className="text-brand-purple/88">
                            {t(`students.items.${key}`)}
                          </a>
                        ))}
                      </div>
                    </div>
                    <PromoTile
                      className="h-[332px] w-[448px]"
                      gradient="h-2/5"
                      media={
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          poster="/images/nav/mp-clip-poster.jpg"
                          className="absolute inset-0 h-full w-full object-cover"
                        >
                          <source src="/video/messenger-pigeon-clip.webm" type="video/webm" />
                        </video>
                      }
                    >
                      <Button href={links.whatsNewVideo}>{t("students.promo.label")}</Button>
                    </PromoTile>
                  </div>
                </div>
              </div>
            </div>

            <a href={links.about} className={navLink}>
              {t("about")}
            </a>
            <a href={links.contact} className={navLink}>
              {t("contact")}
            </a>
          </nav>

          <Button href={links.apply} className="hidden lg:flex">
            {t("getStarted")}
          </Button>
        </div>

        {/* Mobile / tablet menu panel */}
        <div className="absolute inset-x-0 top-full z-[3] hidden bg-paper px-4 py-3 group-has-[#nav-toggle:checked]/nav:flex lg:!hidden">
          <div className="flex w-full flex-col gap-12">
            <div className="flex flex-col gap-3">
              {mobileItems.map(([key, href]) => (
                <div key={key} className="flex flex-col gap-3">
                  <div className="h-px w-full bg-brand-purple/16" />
                  <a href={href} className="flex flex-col items-start text-brand-purple">
                    <span className="text-body-lg">{t(`mobile.items.${key}.label`)}</span>
                    <span className="text-body-sm text-brand-purple/50">
                      {t(`mobile.items.${key}.description`)}
                    </span>
                  </a>
                </div>
              ))}
            </div>
            <PromoTile
              className="h-[245px]"
              media={
                <Image
                  src="/images/nav/mac-mini-privacy.webp"
                  alt={t("mobile.promo.imageAlt")}
                  fill
                  sizes="358px"
                  className="object-cover"
                />
              }
            >
              <Button href={links.blog}>{t("mobile.promo.label")}</Button>
            </PromoTile>
          </div>
        </div>
      </div>

      {/* Dims the page behind the open mobile menu. */}
      <div className="pointer-events-none fixed inset-0 z-[2] hidden bg-brand-purple/25 group-has-[#nav-toggle:checked]/nav:block lg:!hidden" />
    </header>
  );
}
