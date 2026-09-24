import Image from "next/image";
import { stegaClean } from "next-sanity";
import Button from "@/components/ui/Button";
import SanityImage from "@/components/ui/SanityImage";
import SectionLabel from "@/components/ui/SectionLabel";
import PromoTile from "./PromoTile";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { getSiteSettings } from "@/sanity/lib/site";

const navLink =
  "block rounded-button border border-transparent px-3 py-2.5 text-[16px] font-medium leading-4 text-brand-purple transition-colors hover:border-paper/8 hover:bg-brand-purple hover:text-paper";

// Full-width panel that drops below the nav bar while its `group/dd` parent is hovered or focused.
const dropdownPanel =
  "invisible fixed inset-x-0 top-[70px] z-10 pt-5 opacity-0 transition-opacity duration-200 group-hover/dd:visible group-hover/dd:opacity-100 group-focus-within/dd:visible group-focus-within/dd:opacity-100";

export default async function Nav() {
  const settings = await getSiteSettings();
  const { nav } = settings;
  const links = stegaClean(settings.links);
  const { products, resources, start } = nav.organizations.columns;

  // Which link each menu entry points to stays in code; labels and URLs come from Sanity.
  const orgColumns = [
    {
      key: "products",
      label: products.label,
      items: [
        { key: "messengerPigeon", ...products.items.messengerPigeon, href: links.messengerPigeon },
        { key: "podium", ...products.items.podium, href: links.podium },
        { key: "liveServices", ...products.items.liveServices, href: links.liveServices },
      ],
    },
    {
      key: "resources",
      label: resources.label,
      items: [
        { key: "blog", ...resources.items.blog, href: links.blog },
        { key: "help", ...resources.items.help, href: links.help },
        { key: "security", ...resources.items.security, href: links.security },
      ],
    },
    {
      key: "start",
      label: start.label,
      items: [
        { key: "login", ...start.items.login, href: links.adminLogin },
        { key: "bookCall", ...start.items.bookCall, href: links.bookCall },
      ],
    },
  ];

  const studentItems = [
    {
      key: "messengerPigeon",
      label: nav.students.items.messengerPigeon,
      href: links.messengerPigeon,
    },
    { key: "help", label: nav.students.items.help, href: links.help },
    { key: "download", label: nav.students.items.download, href: links.messengerPigeonDownload },
    { key: "helpAgain", label: nav.students.items.helpAgain, href: links.help },
    { key: "login", label: nav.students.items.login, href: links.messengerPigeonLogin },
  ];

  const mobileItems = [
    { key: "messengerPigeon", ...nav.mobile.items.messengerPigeon, href: links.messengerPigeon },
    { key: "liveServices", ...nav.mobile.items.liveServices, href: links.liveServices },
    { key: "about", ...nav.mobile.items.about, href: links.about },
    { key: "blog", ...nav.mobile.items.blog, href: links.blog },
    { key: "contact", ...nav.mobile.items.contact, href: links.contact },
    { key: "login", ...nav.mobile.items.login, href: links.adminLogin },
  ];

  return (
    <header className="group/nav relative z-[999]">
      <div className="relative z-[3] bg-canvas py-4 transition-colors has-[.dd:hover]:bg-paper md:py-5">
        {/* Mobile menu toggle. Checked state is read with group-has-[...]. */}
        <input id="nav-toggle" type="checkbox" aria-label={nav.openMenu} className="peer sr-only" />

        <div className="relative z-[2] mx-auto flex max-w-page items-center justify-between px-8">
          <a href={links.home} className="block">
            <Image
              src="/images/logos/habitat-learn-logo-colour.png"
              alt={nav.logoAlt}
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
            <span className="sr-only">{nav.openMenu}</span>
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
                {nav.organizations.label}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto grid max-w-page grid-cols-4 gap-4 px-8">
                    <div className="col-span-3 grid grid-cols-3 gap-4">
                      {orgColumns.map((column) => (
                        <div key={column.key} className="flex flex-col items-start gap-8">
                          <SectionLabel className="ml-[5px]">{column.label}</SectionLabel>
                          <div className="flex flex-col items-start gap-4">
                            {column.items.map((item) => (
                              <a
                                key={item.key}
                                href={item.href}
                                className="flex max-w-full flex-col items-start text-brand-purple/88"
                              >
                                <div>{item.label}</div>
                                <div className="text-body-sm text-brand-purple/64">
                                  {item.description}
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
                        <SanityImage
                          image={nav.organizations.promo.image}
                          fill
                          sizes="332px"
                          className="object-cover"
                        />
                      }
                    >
                      <Button href={links.blog}>{nav.organizations.promo.label}</Button>
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
                {nav.students.label}
              </div>
              <div className={dropdownPanel}>
                <div className="relative py-8">
                  <div className="absolute inset-0 bg-paper" />
                  <div className="relative mx-auto flex max-w-page justify-between gap-6 px-8">
                    <div className="flex flex-col items-start gap-8">
                      <SectionLabel className="ml-[5px]">{nav.students.columnLabel}</SectionLabel>
                      <div className="flex flex-col items-start">
                        {studentItems.map((item) => (
                          <a key={item.key} href={item.href} className="text-brand-purple/88">
                            {item.label}
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
                      <Button href={links.whatsNewVideo}>{nav.students.promo.label}</Button>
                    </PromoTile>
                  </div>
                </div>
              </div>
            </div>

            <a href={links.about} className={navLink}>
              {nav.about}
            </a>
            <a href={links.contact} className={navLink}>
              {nav.contact}
            </a>
          </nav>

          <Button href={links.apply} className="hidden lg:flex">
            {nav.getStarted}
          </Button>
        </div>

        {/* Mobile / tablet menu panel */}
        <div className="absolute inset-x-0 top-full z-[3] hidden bg-paper px-4 py-3 group-has-[#nav-toggle:checked]/nav:flex lg:!hidden">
          <div className="flex w-full flex-col gap-12">
            <div className="flex flex-col gap-3">
              {mobileItems.map((item) => (
                <div key={item.key} className="flex flex-col gap-3">
                  <div className="h-px w-full bg-brand-purple/16" />
                  <a href={item.href} className="flex flex-col items-start text-brand-purple">
                    <span className="text-body-lg">{item.label}</span>
                    <span className="text-body-sm text-brand-purple/50">{item.description}</span>
                  </a>
                </div>
              ))}
            </div>
            <PromoTile
              className="h-[245px]"
              media={
                <SanityImage
                  image={nav.mobile.promo.image}
                  fill
                  sizes="358px"
                  className="object-cover"
                />
              }
            >
              <Button href={links.blog}>{nav.mobile.promo.label}</Button>
            </PromoTile>
          </div>
        </div>
      </div>

      {/* Dims the page behind the open mobile menu. */}
      <div className="pointer-events-none fixed inset-0 z-[2] hidden bg-brand-purple/25 group-has-[#nav-toggle:checked]/nav:block lg:!hidden" />
    </header>
  );
}
