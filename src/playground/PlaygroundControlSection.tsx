import { ChevronDown, RotateCcw } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../lib/cn";

const CHEVRON_SIZE = 14;
const CHEVRON_STROKE = 1.7;
const RESET_SIZE = 13;

export type PlaygroundControlSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  className?: string;
  /** When true and `onReset` is set, shows a reset-to-defaults icon next to the title. */
  modified?: boolean;
  onReset?: () => void;
};

export const PlaygroundControlSection = ({
  title,
  children,
  defaultOpen = false,
  testId,
  className,
  modified = false,
  onReset,
}: PlaygroundControlSectionProps) => {
  const handleReset = (event: MouseEvent<HTMLButtonElement>) => {
    // Keep the summary from toggling open/closed when the reset icon is clicked.
    event.preventDefault();
    event.stopPropagation();
    onReset?.();
  };

  return (
    <details
      className={cn("group min-w-0 text-sm text-neutral-600 [&_summary::-webkit-details-marker]:hidden", className)}
      data-testid={testId}
      open={defaultOpen}
    >
      <summary className="box-border flex w-full cursor-pointer list-none select-none items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3.5 text-base font-medium text-neutral-800 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400">
        <span className="min-w-0 shrink">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {modified && onReset ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400"
              aria-label={`Reset ${title} to defaults`}
              title="Reset to defaults"
            >
              <RotateCcw aria-hidden size={RESET_SIZE} strokeWidth={CHEVRON_STROKE} />
            </button>
          ) : null}
          <ChevronDown
            aria-hidden
            className="text-neutral-500 group-open:-rotate-180"
            size={CHEVRON_SIZE}
            strokeWidth={CHEVRON_STROKE}
          />
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-2 pt-2 group-open:pb-4">{children}</div>
    </details>
  );
};
