import type { MouseEventHandler, PointerEventHandler, ReactNode } from "react";

type ComponentListItemProps = {
  preview: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  testId?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  as?: "div" | "button";
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
  as = "div",
}: ComponentListItemProps) => {
  const content = (
    <>
      <span className="component-list-item-preview">{preview}</span>
      <span className="component-list-item-text">
        <span className="component-name">{title}</span>
        {meta ? <span className="component-position">{meta}</span> : null}
      </span>
      {actions ? <span className="component-list-item-actions">{actions}</span> : null}
    </>
  );
  const classes = ["component-list-item", className].filter(Boolean).join(" ");

  if (as === "button") {
    return (
      <button
        className={classes}
        data-testid={testId}
        type="button"
        onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
        onPointerDown={onPointerDown as PointerEventHandler<HTMLButtonElement> | undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={classes}
      data-testid={testId}
      onClick={onClick as MouseEventHandler<HTMLDivElement> | undefined}
      onPointerDown={onPointerDown as PointerEventHandler<HTMLDivElement> | undefined}
    >
      {content}
    </div>
  );
};
