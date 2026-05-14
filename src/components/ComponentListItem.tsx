import type { AriaRole, MouseEventHandler, PointerEventHandler, ReactNode } from "react";

type ComponentListItemProps = {
  preview: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  testId?: string;
  role?: AriaRole;
  ariaExpanded?: boolean;
  ariaHasPopup?: "menu" | "listbox" | "tree" | "grid" | "dialog";
  ariaLabel?: string;
  ariaSelected?: boolean;
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
  role,
  ariaExpanded,
  ariaHasPopup,
  ariaLabel,
  ariaSelected,
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
        role={role}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHasPopup}
        aria-label={ariaLabel}
        aria-selected={ariaSelected}
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
      role={role}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
    >
      {content}
    </div>
  );
};
