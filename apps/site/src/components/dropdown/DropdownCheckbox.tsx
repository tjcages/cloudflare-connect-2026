import { Menu } from "@base-ui/react/menu";
import type { ReactNode } from "react";
import Icon from "@/components/icon/Icon";

export default function DropdownCheckbox({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Menu.CheckboxItem
      checked={checked}
      className="group flex min-h-36 w-full shrink-0 cursor-pointer items-start gap-8 p-8 text-left text-label-x-small text-text-base transition-colors duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] outline-none data-highlighted:bg-background-ghost"
      onCheckedChange={onCheckedChange}
    >
      <span className="relative size-20 shrink-0">
        <span className="absolute inset-3 rounded-1 bg-neutral-6 transition-all duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-checked:bg-icon-accent-orange group-data-checked:shadow-button-primary-rest" />

        <Icon
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-icon-inverse opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-checked:opacity-100"
          name="checkmark-1-medium"
          size={16}
        />
      </span>

      <span className="px-4 text-balance">{children}</span>
    </Menu.CheckboxItem>
  );
}
