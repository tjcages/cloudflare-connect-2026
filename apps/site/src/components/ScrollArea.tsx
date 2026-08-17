import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import cn from "classnames";
import type { ReactNode, Ref } from "react";

export default function ScrollArea({
  className,
  contentClassName,
  viewportClassName,
  children,
  viewportRef,
  horizontal = false,
  verticalScrollbarClassName,
  verticalThumbClassName,
}: {
  className?: string;
  contentClassName?: string;
  viewportClassName?: string;
  children: ReactNode;
  viewportRef?: Ref<HTMLDivElement>;
  horizontal?: boolean;
  verticalScrollbarClassName?: string;
  verticalThumbClassName?: string;
}) {
  return (
    <BaseScrollArea.Root className={cn("relative", className)}>
      <BaseScrollArea.Viewport
        className={cn("h-full", viewportClassName)}
        ref={viewportRef}
      >
        <BaseScrollArea.Content className={cn("min-w-full", contentClassName)}>
          {children}
        </BaseScrollArea.Content>
      </BaseScrollArea.Viewport>

      <BaseScrollArea.Scrollbar
        className={cn(
          "group top-4! right-4! bottom-4! z-20 w-4 opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100",
          verticalScrollbarClassName
        )}
        orientation="vertical"
      >
        <BaseScrollArea.Thumb
          className={cn(
            "w-full rounded-full bg-neutral-8/40 transition-colors duration-150 group-active:bg-neutral-8/72",
            verticalThumbClassName
          )}
        />
      </BaseScrollArea.Scrollbar>

      {horizontal && (
        <BaseScrollArea.Scrollbar
          className="group right-4! bottom-4! left-4! z-20 h-4 opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100"
          orientation="horizontal"
        >
          <BaseScrollArea.Thumb className="h-full rounded-full bg-neutral-8/40 transition-colors duration-150 group-active:bg-neutral-8/72" />
        </BaseScrollArea.Scrollbar>
      )}
    </BaseScrollArea.Root>
  );
}
