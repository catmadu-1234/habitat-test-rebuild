import Image from "next/image";
import { stegaClean } from "next-sanity";
import Label from "@/components/ui/Label";
import { getSiteSettings } from "@/sanity/lib/site";

export default async function Footer() {
  const settings = await getSiteSettings();
  const { footer } = settings;
  const links = stegaClean(settings.links);
  const { login, company, resources, more } = footer.columns;

  // Which link each entry points to stays in code; labels and URLs come from Sanity.
  const columns = [
    {
      key: "login",
      label: login.label,
      items: [
        {
          key: "messengerPigeon",
          label: login.items.messengerPigeon,
          href: links.messengerPigeonLogin,
        },
        { key: "admin", label: login.items.admin, href: links.adminLogin },
      ],
    },
    {
      key: "company",
      label: company.label,
      items: [
        { key: "about", label: company.items.about, href: links.about },
        { key: "careers", label: company.items.careers, href: links.careers },
        { key: "security", label: company.items.security, href: links.security },
        { key: "download", label: company.items.download, href: links.messengerPigeonDownload },
      ],
    },
    {
      key: "resources",
      label: resources.label,
      items: [
        { key: "help", label: resources.items.help, href: links.help },
        { key: "blog", label: resources.items.blog, href: links.blog },
        { key: "grants", label: resources.items.grants, href: links.grants },
        { key: "bookCall", label: resources.items.bookCall, href: links.contact },
        { key: "partners", label: resources.items.partners, href: links.partners },
      ],
    },
    {
      key: "more",
      label: more.label,
      items: [
        { key: "privacy", label: more.items.privacy, href: links.privacy },
        { key: "securityAi", label: more.items.securityAi, href: links.securityAi },
        { key: "terms", label: more.items.terms, href: links.terms },
        { key: "accessibility", label: more.items.accessibility, href: links.accessibility },
      ],
    },
  ];

  const social = [
    { key: "youtube", label: footer.social.youtube, href: links.youtube },
    { key: "linkedin", label: footer.social.linkedin, href: links.linkedin },
    { key: "instagram", label: footer.social.instagram, href: links.instagram },
    { key: "tiktok", label: footer.social.tiktok, href: links.tiktok },
  ];

  return (
    <footer className="relative z-[1] bg-brand-green pb-4 pt-12 text-paper/88 md:pb-8 md:pt-20">
      <div className="mx-auto flex max-w-page flex-col gap-10 px-page pb-10 md:gap-content">
        <div className="grid grid-cols-1 gap-12 md:gap-16 lg:grid-cols-2">
          <a href={links.home} className="block w-[136px] md:w-[170px]">
            <Image
              src="/images/logos/habitat-learn-logo-white.png"
              alt={footer.logoAlt}
              width={1975}
              height={907}
              className="h-auto w-full"
            />
          </a>

          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-4">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-4 md:gap-5">
                <Label size="sm" className="text-paper/64">
                  {column.label}
                </Label>
                <div className="flex flex-col">
                  {column.items.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="transition-opacity hover:opacity-70"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-paper/16 pb-6 pt-8 md:gap-8 md:pb-8 md:pt-12">
          <div className="flex items-center gap-3 md:gap-4">
            {social.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="block h-3 w-3 transition-opacity hover:opacity-50 md:h-4 md:w-4"
              >
                <Image
                  src={`/images/icons/${item.key}.svg`}
                  alt={item.label}
                  width={16}
                  height={16}
                  className="h-full w-full"
                  unoptimized
                />
              </a>
            ))}
          </div>
          <Label size="sm" className="text-paper/64">
            {footer.copyright}
          </Label>
        </div>
      </div>
    </footer>
  );
}
