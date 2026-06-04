import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

const CHEVRON_SIZE = 14;
const CHEVRON_STROKE = 1.7;

export type PlaygroundControlSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  className?: string;
};

export const PlaygroundControlSection = ({
  title,
  children,
  defaultOpen = false,
  testId,
  className,
}: PlaygroundControlSectionProps) => (
  <details
    className={cn("group min-w-0 text-sm text-neutral-600 [&_summary::-webkit-details-marker]:hidden", className)}
    data-testid={testId}
    open={defaultOpen}
  >
    <summary className="box-border flex w-full cursor-pointer list-none select-none items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3.5 text-base font-medium text-neutral-800 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400">
      <span className="min-w-0 shrink">{title}</span>
      <ChevronDown
        aria-hidden
        className="shrink-0 text-neutral-500 group-open:-rotate-180"
        size={CHEVRON_SIZE}
        strokeWidth={CHEVRON_STROKE}
      />
    </summary>
    <div className="flex flex-col gap-3 px-4 pb-2 pt-2 group-open:pb-4">{children}</div>
  </details>
);
