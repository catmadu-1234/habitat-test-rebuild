import { cn } from "@/lib/cn";
import SectionLabel from "./SectionLabel";

const headingSizes = {
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-h4",
} as const;

type SectionHeaderProps = {
  label: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  /** Type-scale step for the heading; the level stays <h2> for document order. */
  size?: keyof typeof headingSizes;
  /** `tight` uses a 16px gap and adds the heading margins used by the "values" header. */
  spacing?: "default" | "tight";
  className?: string;
};

// Label pill + heading (+ optional paragraph) that opens a section.
export default function SectionHeader({
  label,
  title,
  description,
  align = "left",
  size = "h2",
  spacing = "default",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex max-w-headline flex-col",
        spacing === "tight" ? "gap-4" : "gap-4 md:gap-6",
        align === "center" ? "mx-auto items-center text-center" : "items-start",
        className,
      )}
    >
      <SectionLabel className="ml-[5px]">{label}</SectionLabel>
      <h2
        className={cn(
          "font-heading text-brand-purple",
          headingSizes[size],
          spacing === "tight" && "mb-2.5 mt-5",
        )}
      >
        {title}
      </h2>
      {description && <p className="mb-2.5 text-brand-purple/88">{description}</p>}
    </div>
  );
}
