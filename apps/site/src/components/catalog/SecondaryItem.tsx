import HoverArrow from "@/components/HoverArrow";
import Icon from "@/components/icon/Icon";
import type { CatalogItem } from "./types";

export default function SecondaryItem({ item }: { item: CatalogItem }) {
  return (
    <a
      className="group flex h-40 items-center gap-12 px-12 outline-none focus-visible:shadow-button-tertiary-focus"
      href={item.href}
    >
      <Icon
        className="shrink-0 text-icon-muted transition-colors [--icon-color-primary:var(--color-icon-muted)] [--icon-color-secondary:var(--color-icon-subtle)] **:transition-[fill,stroke] group-hover:text-orange-900 group-hover:[--icon-color-primary:var(--color-orange-900)] group-hover:[--icon-color-secondary:var(--color-orange-800)]"
        color="colorless"
        name={item.iconName}
        size={20}
        variant="duo"
      />

      <div className="relative flex h-20 items-center">
        <div className="text-label-x-small whitespace-nowrap text-text-base transition-colors group-hover:text-orange-900">
          {item.label}
        </div>
        <HoverArrow
          className="absolute top-0 left-full ml-2"
          color="text-orange-900"
        />
      </div>
    </a>
  );
}
