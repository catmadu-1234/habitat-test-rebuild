import { cn } from "@/lib/cn";

// Small uppercase text. `md` = card meta / form labels, `sm` = footer column titles.
const sizes = {
  md: "text-label",
  sm: "text-label-sm",
} as const;

export default function Label({
  size = "md",
  htmlFor,
  className,
  children,
}: {
  size?: keyof typeof sizes;
  /** Renders a <label> for a form control instead of a <div>. */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn("uppercase", sizes[size], className);
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cn("block", classes)}>
      {children}
    </label>
  ) : (
    <div className={classes}>{children}</div>
  );
}
