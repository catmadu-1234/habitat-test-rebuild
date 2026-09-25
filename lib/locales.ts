export type Direction = "ltr" | "rtl";

export type LocaleConfig = {
  /** URL segment and part of Sanity document ids. Lowercase. */
  code: string;
  /** Language id in the Crowdin project. */
  crowdinId: string;
  /** Value for <html lang> and hreflang. */
  htmlLang: string;
  dir: Direction;
};

export const DEFAULT_LOCALE = "en";

// Which of these are visible is decided per language in Sanity (siteSettings.languages status).
// Adding a language: add it here AND to schemaTypes/shared/language-codes.ts in the Studio repo.
export const LOCALES: readonly LocaleConfig[] = [
  { code: "en", crowdinId: "en", htmlLang: "en", dir: "ltr" },
  { code: "zh-cn", crowdinId: "zh-CN", htmlLang: "zh-CN", dir: "ltr" },
  { code: "zh-tw", crowdinId: "zh-TW", htmlLang: "zh-TW", dir: "ltr" },
  { code: "es", crowdinId: "es", htmlLang: "es", dir: "ltr" },
  { code: "fr", crowdinId: "fr", htmlLang: "fr", dir: "ltr" },
  { code: "de", crowdinId: "de", htmlLang: "de", dir: "ltr" },
  { code: "ja", crowdinId: "ja", htmlLang: "ja", dir: "ltr" },
  { code: "ko", crowdinId: "ko", htmlLang: "ko", dir: "ltr" },
  { code: "pt-br", crowdinId: "pt-BR", htmlLang: "pt-BR", dir: "ltr" },
  { code: "it", crowdinId: "it", htmlLang: "it", dir: "ltr" },
  { code: "ar", crowdinId: "ar", htmlLang: "ar", dir: "rtl" },
  { code: "hi", crowdinId: "hi", htmlLang: "hi", dir: "ltr" },
  { code: "nl", crowdinId: "nl", htmlLang: "nl", dir: "ltr" },
  { code: "sv", crowdinId: "sv", htmlLang: "sv", dir: "ltr" },
  { code: "da", crowdinId: "da", htmlLang: "da", dir: "ltr" },
  { code: "nb", crowdinId: "nb", htmlLang: "nb", dir: "ltr" },
  { code: "fi", crowdinId: "fi", htmlLang: "fi", dir: "ltr" },
  { code: "ro", crowdinId: "ro", htmlLang: "ro", dir: "ltr" },
];

export const NON_DEFAULT_LOCALES = LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE);

export function getLocale(code: string): LocaleConfig | undefined {
  return LOCALES.find((locale) => locale.code === code);
}

// English lives at the root; every other locale is a prefix.
export function localePath(code: string, path = "/"): string {
  if (code === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${code}` : `/${code}${path}`;
}
