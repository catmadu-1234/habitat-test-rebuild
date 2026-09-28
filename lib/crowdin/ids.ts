// One Sanity document per language and source document. No dots: ids containing "." are private in Sanity.
export const translationId = (code: string, sourceId: string) => `translation-${code}-${sourceId}`;

// Key used inside translationStatus.stored to remember which hash of a source a language was stored for.
export const storeKey = (code: string, sourceId: string) => `${code}__${sourceId}`;
