import { DEFAULT_LOCALE, LOCALES, type LocaleConfig } from "./locales.ts";

export type LanguageStatus = "off" | "preview" | "live";
export type LanguageRow = {
  code?: string | null;
  nativeName?: string | null;
  status?: string | null;
};
type Rows = readonly LanguageRow[] | null | undefined;

export function statusFor(rows: Rows, code: string): LanguageStatus {
  if (code === DEFAULT_LOCALE) return "live";
  const status = rows?.find((row) => row.code === code)?.status;
  return status === "live" || status === "preview" ? status : "off";
}

// Languages shown in the switcher: live, named, in the order of LOCALES.
export function liveLanguages(rows: Rows): { code: string; nativeName: string }[] {
  return LOCALES.flatMap((locale) => {
    if (statusFor(rows, locale.code) !== "live") return [];
    const nativeName = rows?.find((row) => row.code === locale.code)?.nativeName;
    return nativeName ? [{ code: locale.code, nativeName }] : [];
  });
}

// Languages Crowdin should translate into.
export function activeLocales(rows: Rows): LocaleConfig[] {
  return LOCALES.filter(
    (locale) => locale.code !== DEFAULT_LOCALE && statusFor(rows, locale.code) !== "off",
  );
}
