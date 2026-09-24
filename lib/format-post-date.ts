// Blog cards show month and year only ("Aug 2026"). Pinned to UTC so the month never
// shifts with the reader's or the server's time zone.
const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostDate(date: string): string {
  return formatter.format(new Date(`${date}T00:00:00Z`));
}
