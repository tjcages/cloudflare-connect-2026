import { Menu } from "@base-ui/react/menu";
import cn from "classnames";
import type { ReactNode } from "react";

export default function DropdownItem({
  onClick,
  closeOnClick = true,
  className,
  children,
}: {
  onClick?: () => void;
  closeOnClick?: boolean;
  className?: string | string[];
  children: ReactNode;
}) {
  return (
    <Menu.Item
      className={cn(
        "flex min-h-36 cursor-pointer items-center gap-8 p-8 text-left text-label-x-small text-text-base transition-colors duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] outline-none data-highlighted:bg-background-ghost",
        className
      )}
      closeOnClick={closeOnClick}
      onClick={onClick}
    >
      {children}
    </Menu.Item>
  );
}
