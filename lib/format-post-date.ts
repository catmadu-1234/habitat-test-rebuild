// Blog cards show month and year only ("Aug 2026"). Pinned to UTC so the month never
// shifts with the reader's or the server's time zone.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(lang: string): Intl.DateTimeFormat {
  let formatter = formatters.get(lang);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" });
    formatters.set(lang, formatter);
  }
  return formatter;
}

// A draft post in Presentation can have no date yet; render nothing instead of throwing.
export function formatPostDate(date: string | null | undefined, lang = "en-US"): string {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : formatterFor(lang).format(parsed);
}
