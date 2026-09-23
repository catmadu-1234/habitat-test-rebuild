import { cn } from "@/lib/cn";

// Literal class strings (not built dynamically) so Tailwind can detect them.
const top = {
  none: "",
  sm: "pt-section-sm",
  md: "pt-section-md",
  lg: "pt-section-lg",
} as const;

const bottom = {
  none: "",
  sm: "pb-section-sm",
  md: "pb-section-md",
  lg: "pb-section-lg",
} as const;

type SectionProps = {
  /** Vertical padding above/below the content, from the section spacing tokens. */
  top?: keyof typeof top;
  bottom?: keyof typeof bottom;
  /** Classes for the <section> itself (background, etc). */
  className?: string;
  /** Rendered behind the container, e.g. a background image or overlay. */
  backdrop?: React.ReactNode;
  children: React.ReactNode;
};

// Every homepage section: full-width background + centered, padded container.
export default function Section({
  top: sectionTop = "none",
  bottom: sectionBottom = "none",
  className,
  backdrop,
  children,
}: SectionProps) {
  return (
    <section
      className={cn("relative bg-canvas", top[sectionTop], bottom[sectionBottom], className)}
    >
      {backdrop}
      <div className="relative mx-auto max-w-page px-page pb-10">{children}</div>
    </section>
  );
}
