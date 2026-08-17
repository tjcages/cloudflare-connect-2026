import cn from "classnames";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export default function Badge({
  children,
  className,
  padded = true,
  ref,
}: BadgeProps) {
  return (
    <div
      className={cn(
        "pointer-events-none rounded-full bg-background-surface text-body-tiny shadow-[0_0_0_4px_var(--color-background-surface)] before:inside-border before:border-border-muted",
        padded && "px-10 py-4",
        className
      )}
      ref={ref}
    >
      {children}
    </div>
  );
}
