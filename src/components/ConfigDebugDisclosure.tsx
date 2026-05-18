import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH } from "./iconTokens";

export type ConfigDebugDisclosureProps = {
  children: ReactNode;
  /** Row label in the summary (default `Debug`). */
  label?: string;
  /** Optional `data-testid` on the root `<details>`. */
  testId?: string;
  /** Extra classes on the root `<details>` (e.g. omit `mt-auto` if not bottom-pinned). */
  className?: string;
};

/**
 * Collapsible debug block for `LayerConfigPanel` (or any padded config column using `px-3.5`).
 *
 * Render as the **last** child inside a column flex wrapper with `flex-1 min-h-0`, after main fields, so
 * `mt-auto` pins it to the bottom. Pass table or copy as `children`.
 */
export const ConfigDebugDisclosure = ({ children, label = "Debug", testId, className }: ConfigDebugDisclosureProps) => (
  <details
    className={cn(
      "group mt-auto min-h-0 min-w-0 text-[12px] text-builder-muted [&_summary::-webkit-details-marker]:hidden",
      className,
    )}
    data-testid={testId}
  >
    <summary className="-mx-3.5 box-border flex h-10 w-[calc(100%+1.75rem)] max-w-none min-w-0 list-none cursor-pointer select-none items-center justify-between gap-2 border-t border-builder-hairline bg-builder-surface px-3.5 py-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9fc8ff]">
      <span className="min-w-0 shrink">{label}</span>
      <ChevronDown
        aria-hidden
        className="shrink-0 text-current group-open:-rotate-180"
        size={ACTION_ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    </summary>
    <div className="mt-2 flex flex-col gap-2 group-open:pb-3.5">{children}</div>
  </details>
);
