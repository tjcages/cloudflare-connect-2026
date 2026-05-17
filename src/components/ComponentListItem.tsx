import type { MouseEventHandler, PointerEventHandler, ReactNode } from "react";
import { cn } from "../lib/cn";

type ComponentListItemProps = {
  preview?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  testId?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  as?: "div" | "button";
  /** Config panel header keeps action icons visible without row hover */
  persistActionsOpacity?: boolean;
  /** Layers list aligns content to the top of the preview column */
  textAlignTop?: boolean;
};

export const ComponentListItem = ({
  preview,
  title,
  meta,
  actions,
  className,
  testId,
  onClick,
  onPointerDown,
  onPointerEnter,
  as = "div",
  persistActionsOpacity,
  textAlignTop,
}: ComponentListItemProps) => {
  const content = (
    <>
      {preview !== undefined ? (
        <span
          data-slot="list-item-preview"
          className="grid size-4 place-items-center rounded-full border-0 bg-transparent [&>svg]:block"
        >
          {preview}
        </span>
      ) : null}
      <span
        className={cn(
          "list-item-text flex min-h-4 min-w-0 flex-col gap-[3px]",
          textAlignTop ? "justify-start" : "justify-center",
        )}
      >
        <span className="truncate text-[12px] leading-[1.1] text-builder-muted">{title}</span>
        {meta ? (
          <span data-slot="list-item-meta" className="truncate text-[10px] leading-[1.1] text-builder-subtle">
            {meta}
          </span>
        ) : null}
      </span>
      {actions ? (
        <span
          className={cn(
            "flex items-center gap-1",
            persistActionsOpacity ? "opacity-100" : "opacity-0 group-hover/list-item:opacity-100",
          )}
          data-slot="list-item-actions"
        >
          {actions}
        </span>
      ) : null}
    </>
  );
  const cols = cn(
    "grid w-full min-w-0 items-center gap-2 border-0 bg-transparent py-2",
    preview === undefined
      ? "grid-cols-[minmax(0,1fr)_auto] pl-4 pr-2.5"
      : "grid-cols-[16px_minmax(0,1fr)_auto] pl-3 pr-2.5",
  );

  if (as === "button") {
    return (
      <button
        className={cn(
          cols,
          "group/list-item cursor-pointer touch-none text-left text-inherit hover:bg-builder-hover-row",
          className,
        )}
        data-testid={testId}
        type="button"
        onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
        onPointerDown={onPointerDown as PointerEventHandler<HTMLButtonElement> | undefined}
        onPointerEnter={onPointerEnter as PointerEventHandler<HTMLButtonElement> | undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(cols, "group/list-item", className)}
      data-testid={testId}
      onPointerEnter={onPointerEnter as PointerEventHandler<HTMLDivElement> | undefined}
    >
      {content}
    </div>
  );
};
