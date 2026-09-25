export type StringMap = Record<string, string>;

// Keys that hold logic, not copy.
const NON_TRANSLATABLE_KEYS = new Set(["language", "variant", "date", "url", "href"]);
// Whole sub-trees that are never translated (relative to the document root).
const NON_TRANSLATABLE_PATHS = new Set(["links", "languages"]);
const ABSOLUTE_URL = /^https?:\/\//i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function isTranslatable(key: string, value: string): boolean {
  if (NON_TRANSLATABLE_KEYS.has(key)) return false;
  if (value.trim() === "") return false;
  if (ABSOLUTE_URL.test(value)) return false;
  if (ISO_DATE.test(value)) return false;
  return true;
}

type Visit = (path: string, value: string) => string;

// One walker for both directions so extraction keys and merge keys can never drift apart.
function transform(
  node: unknown,
  path: string,
  key: string,
  visit: Visit,
  strict: boolean,
): unknown {
  if (typeof node === "string") return isTranslatable(key, node) ? visit(path, node) : node;

  if (Array.isArray(node)) {
    return node.map((item, index) => {
      const itemKey =
        item && typeof item === "object" && typeof (item as { _key?: unknown })._key === "string"
          ? (item as { _key: string })._key
          : String(index);
      return transform(item, `${path}[${itemKey}]`, key, visit, strict);
    });
  }

  if (node && typeof node === "object") {
    const object = node as Record<string, unknown>;
    if (strict && (object._type === "block" || object._type === "span")) {
      throw new Error(
        "Portable Text (rich text) is not supported by the translation extractor yet. Add support in lib/crowdin/extract.ts before adding such a field.",
      );
    }
    const out: Record<string, unknown> = {};
    for (const [childKey, value] of Object.entries(object)) {
      const childPath = path ? `${path}.${childKey}` : childKey;
      if (childKey.startsWith("_") || NON_TRANSLATABLE_PATHS.has(childPath)) {
        out[childKey] = value;
      } else {
        out[childKey] = transform(value, childPath, childKey, visit, strict);
      }
    }
    return out;
  }

  return node;
}

export function extractStrings(doc: unknown, prefix = ""): StringMap {
  const map: StringMap = {};
  transform(
    doc,
    prefix,
    "",
    (path, value) => {
      map[path] = value;
      return value;
    },
    true,
  );
  return map;
}

// Returns a copy of `data` with translated strings swapped in. Missing or blank translations keep English.
export function applyTranslations<T>(data: T, map: StringMap, prefix = ""): T {
  return transform(
    data,
    prefix,
    "",
    (path, value) => (map[path]?.trim() ? map[path] : value),
    false,
  ) as T;
}

export async function hashStrings(map: StringMap): Promise<string> {
  const entries = Object.keys(map)
    .sort()
    .map((key) => [key, map[key]]);
  const bytes = new TextEncoder().encode(JSON.stringify(entries));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A stored translation document must never be able to break a page: anything unexpected means "no translation".
export function parseStrings(json: unknown): StringMap | null {
  if (typeof json !== "string" || json === "") return null;
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const map: StringMap = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "string") map[key] = entry;
    }
    return map;
  } catch {
    return null;
  }
}
