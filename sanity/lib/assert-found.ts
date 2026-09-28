// Singleton content that is missing means the dataset was never seeded; fail loudly at build time.
export function assertFound<T>(value: T, label: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(
      `No Sanity content found for: ${label.trim()}\nCreate the document in the Studio (the site never invents content).`,
    );
  }
  return value as NonNullable<T>;
}
