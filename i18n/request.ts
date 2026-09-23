import { getRequestConfig } from "next-intl/server";

// Locale is read from SITE_LOCALE (defaults to "en"). To add a language, drop
// a folder such as locales/fr/ containing home.json and common.json (Crowdin
// can write these). Per-locale URLs (/fr) would additionally need next-intl
// routing; see README.
const defaultLocale = "en";

export default getRequestConfig(async () => {
  const locale = process.env.SITE_LOCALE ?? defaultLocale;

  return {
    locale,
    messages: {
      common: (await import(`../locales/${locale}/common.json`)).default,
      home: (await import(`../locales/${locale}/home.json`)).default,
    },
  };
});
