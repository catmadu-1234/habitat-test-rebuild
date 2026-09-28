import { cn } from "@/lib/cn";

// Nav promo card: media fills the tile, a purple gradient sits under the CTA.
// Pass an <Image> or <video> as `media` and a <Button> as `children`.
export default function PromoTile({
  media,
  gradient = "h-1/2",
  className,
  children,
}: {
  media: React.ReactNode;
  /** Height of the bottom gradient, as a Tailwind height class. */
  gradient?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative flex items-end overflow-hidden rounded-card p-3 md:p-4", className)}
    >
      {media}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-purple/64 to-transparent",
          gradient,
        )}
      />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
