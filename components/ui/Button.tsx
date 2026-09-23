import { ArrowIcon } from "./Icons";

type ButtonProps = {
  href: string;
  variant?: "primary" | "secondary";
  withArrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

// Pill button. `primary` is green (turns purple on hover); `secondary` is
// purple (turns green on hover). The label rolls up on hover, like the live site.
export default function Button({
  href,
  variant = "primary",
  withArrow = false,
  className = "",
  children,
}: ButtonProps) {
  const overlay =
    variant === "primary"
      ? "border-paper/8 bg-brand-green group-hover:bg-brand-purple"
      : "border-brand-purple/16 bg-transparent group-hover:border-paper/8 group-hover:bg-brand-green";

  return (
    <a
      href={href}
      className={`group relative flex items-center justify-center gap-[11px] rounded-button bg-brand-purple px-[30px] py-2.5 text-button font-medium text-canvas md:py-3 ${className}`}
    >
      <span
        aria-hidden
        className={`absolute inset-0 rounded-button border shadow-button transition-colors duration-300 ${overlay}`}
      />
      <span className="relative z-[1] flex h-5 overflow-hidden md:h-6">
        <span className="block whitespace-nowrap transition-transform duration-300 [text-shadow:0_1.5em_0_#f7f7f2] group-hover:-translate-y-[1.5em]">
          {children}
        </span>
      </span>
      {withArrow && (
        <span className="relative z-[1] -mr-1 flex h-3 w-3 items-center justify-end overflow-hidden md:h-4 md:w-4">
          <ArrowIcon className="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:translate-x-full" />
          <ArrowIcon className="absolute inset-0 h-full w-full -translate-x-full transition-transform duration-300 group-hover:translate-x-0" />
        </span>
      )}
    </a>
  );
}
