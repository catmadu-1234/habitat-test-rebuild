// Blog cards show month and year only ("Aug 2026"). Pinned to UTC so the month never
// shifts with the reader's or the server's time zone.
const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// A draft post in Presentation can have no date yet; render nothing instead of throwing.
export function formatPostDate(date: string | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : formatter.format(parsed);
}
