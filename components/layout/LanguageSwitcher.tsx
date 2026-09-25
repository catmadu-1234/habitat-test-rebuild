import { liveLanguages } from "@/lib/languages";
import { getLocale, localePath } from "@/lib/locales";
import { getLanguages } from "@/sanity/lib/languages";

type Props = { locale: string; label: string; variant: "dropdown" | "list" };

export default async function LanguageSwitcher({ locale, label, variant }: Props) {
  const rows = await getLanguages();
  const languages = liveLanguages(rows);
  if (languages.length < 2) return null;

  const currentName =
    rows.find((row) => row.code === locale)?.nativeName ?? languages[0].nativeName;
  const items = languages.map((language) => ({
    ...language,
    href: localePath(language.code),
    lang: getLocale(language.code)?.htmlLang,
  }));

  if (variant === "list") {
    return (
      <nav aria-label={label} className="flex flex-col gap-3">
        <div className="h-px w-full bg-brand-purple/16" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {items.map((item) => (
            <li key={item.code}>
              <a
                href={item.href}
                hrefLang={item.lang}
                lang={item.lang}
                aria-current={item.code === locale ? "true" : undefined}
                className="block py-1 text-body text-brand-purple aria-[current=true]:font-medium"
              >
                {item.nativeName}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className="dd group/dd relative">
      <div
        tabIndex={0}
        role="button"
        aria-haspopup="true"
        aria-label={label}
        className="flex cursor-pointer items-center rounded-button border border-transparent px-3 py-2.5 text-[16px] font-medium leading-4 text-brand-purple transition-colors group-focus-within/dd:border-paper/8 group-focus-within/dd:bg-brand-purple group-focus-within/dd:text-paper group-hover/dd:border-paper/8 group-hover/dd:bg-brand-purple group-hover/dd:text-paper"
      >
        <span lang={getLocale(locale)?.htmlLang}>{currentName}</span>
      </div>
      <div className="invisible absolute end-0 top-full z-10 pt-2 opacity-0 transition-opacity duration-200 group-focus-within/dd:visible group-focus-within/dd:opacity-100 group-hover/dd:visible group-hover/dd:opacity-100">
        <ul className="grid max-h-[70vh] w-[340px] grid-cols-2 gap-1 overflow-y-auto rounded-panel bg-paper p-3 shadow-button">
          {items.map((item) => (
            <li key={item.code}>
              <a
                href={item.href}
                hrefLang={item.lang}
                lang={item.lang}
                aria-current={item.code === locale ? "true" : undefined}
                className="block rounded-button px-3 py-2 text-brand-purple/88 hover:bg-brand-purple hover:text-paper aria-[current=true]:font-medium"
              >
                {item.nativeName}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
