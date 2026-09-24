import Image, { type ImageProps } from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "@/sanity/lib/image";

// Structural subset of an `imageWithAlt` value as returned by GROQ.
export type SanityImageValue = {
  asset?: { _ref: string } | null;
  crop?: object | null;
  hotspot?: object | null;
  alt?: string | null;
};

type SanityImageProps = Omit<ImageProps, "src" | "alt"> & {
  /** May be missing while an editor is mid-edit in Draft Mode; nothing renders then. */
  image?: SanityImageValue | null;
  /** Overrides the editor's alt text; pass "" for a decorative repeat of another image. */
  alt?: string;
};

// next/image for a Sanity image. The editor's crop is applied by urlFor; resizing is left to
// next/image. Renders nothing if the editor removed the asset, so the page never crashes.
export default function SanityImage({ image, alt, ...props }: SanityImageProps) {
  if (!image?.asset) return null;

  return (
    <Image src={urlFor(image as SanityImageSource).url()} alt={alt ?? image.alt ?? ""} {...props} />
  );
}
