// Singleton content that is missing means the dataset was never seeded; fail loudly at build time.
export function assertFound<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `No Sanity content found for: ${label.trim()}\nHas the dataset been seeded? Run "npm run seed" in studio/.`,
    );
  }
  return value;
}
