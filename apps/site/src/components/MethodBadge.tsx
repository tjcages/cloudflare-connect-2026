import cn from "classnames";

export type MethodBadgeMethod = "GET" | "POST" | "PUT" | "DELETE";
export type MethodBadgeVariant = "loud" | "faint";

interface MethodBadgeProps {
  className?: string;
  method: MethodBadgeMethod;
  variant?: MethodBadgeVariant;
}

const LOUD_CLASSES: Record<MethodBadgeMethod, string> = {
  GET: "bg-icon-accent-success text-text-inverse",
  POST: "bg-blue-900 text-text-inverse",
  PUT: "bg-orange-900 text-text-inverse",
  DELETE: "bg-red-900 text-text-inverse",
};

const FAINT_CLASSES: Record<MethodBadgeMethod, string> = {
  GET: "bg-(--color-dynamic-green-7) text-(--color-text-accent-success) before:border-(--color-dynamic-green-6)",
  POST: "bg-(--color-dynamic-blue-7) text-(--color-text-accent-info) before:border-(--color-dynamic-blue-6)",
  PUT: "bg-(--color-dynamic-orange-7) text-(--color-text-accent-orange) before:border-(--color-dynamic-orange-6)",
  DELETE:
    "bg-(--color-dynamic-red-7) text-(--color-text-accent-warning) before:border-(--color-dynamic-red-6)",
};

export default function MethodBadge({
  className,
  method,
  variant = "loud",
}: MethodBadgeProps) {
  return (
    <span
      className={cn(
        "relative flex-center shrink-0 rounded-full px-10 text-mono-tiny whitespace-nowrap",
        variant === "faint"
          ? ["before:inside-border", FAINT_CLASSES[method]]
          : LOUD_CLASSES[method],
        className
      )}
    >
      {method}
    </span>
  );
}
