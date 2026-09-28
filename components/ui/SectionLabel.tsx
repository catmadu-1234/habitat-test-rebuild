// Small uppercase pill that sits above section headings.
export default function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center rounded-button bg-lift p-2.5 backdrop-blur-[10px] ${className}`}
    >
      <div className="text-center text-label-sm uppercase text-brand-purple">{children}</div>
    </div>
  );
}
