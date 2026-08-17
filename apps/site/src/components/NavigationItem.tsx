import cn from "classnames";
import type { ReactNode } from "react";
import HoverArrow from "@/components/HoverArrow";
import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";
import NewBadge from "@/components/NewBadge";

type NavigationItemProps = {
  href: string;
  label: string;
  description: string;
  isNew?: boolean;
} & (
  { icon: IconName; children?: never } | { icon?: never; children: ReactNode }
);

export default function NavigationItem({
  href,
  label,
  description,
  isNew,
  icon,
  children,
}: NavigationItemProps) {
  return (
    <a
      className={cn(
        "group flex rounded-12 outline-none focus-visible:shadow-button-tertiary-focus",
        icon ? "gap-16" : "items-center gap-20"
      )}
      href={href}
    >
      {icon ? (
        <div className="relative flex-center size-48 rounded-full before:inside-border before:border-border-muted">
          <Icon name={icon} variant="duo" />
        </div>
      ) : (
        children
      )}

      <div className={cn("min-w-0 flex-1", icon ? "py-3" : "py-8 pr-8")}>
        <div
          className={cn(
            "flex items-center gap-6 transition-colors duration-150 group-hover:text-orange-900",
            icon ? "mb-2" : "mb-4"
          )}
        >
          <div className="line-clamp-1 text-label-x-small">{label}</div>

          {isNew && <NewBadge />}

          <HoverArrow className="-ml-4" />
        </div>

        <div
          className={cn(
            "text-body-x-small",
            icon ? "truncate text-text-muted" : "line-clamp-2 text-text-default"
          )}
        >
          {description}
        </div>
      </div>
    </a>
  );
}
