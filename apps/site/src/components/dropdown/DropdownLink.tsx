import { Menu } from "@base-ui/react/menu";
import cn from "classnames";
import type { MouseEvent, ReactNode } from "react";

export default function DropdownLink({
  href,
  onClick,
  className,
  children,
}: {
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string | string[];
  children: ReactNode;
}) {
  return (
    <Menu.LinkItem
      className={cn(
        "flex min-h-36 cursor-pointer items-center gap-8 p-8 text-label-x-small text-text-base transition-colors duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] outline-none data-highlighted:bg-background-ghost",
        className
      )}
      closeOnClick
      href={href}
      onClick={onClick}
    >
      {children}
    </Menu.LinkItem>
  );
}
