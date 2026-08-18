import cn from "classnames";
import NavigationItem from "@/components/NavigationItem";
import SecondaryItem from "./SecondaryItem";
import type { CatalogGroup } from "./types";

export default function GroupCard({
  group,
  columns,
}: {
  group: CatalogGroup;
  columns: 2 | 3;
}) {
  const hasPrimary = group.items.length > 0;
  const hasSecondary = (group.secondaryItems?.length ?? 0) > 0;

  return (
    <section
      className="relative scroll-mt-80 bg-background-base p-40 before:inside-border before:border-border-muted max-sm:p-24"
      id={group.slug}
    >
      <h2 className="text-heading-h5 text-text-base">{group.label}</h2>

      <div className="mx-4 mt-32 mb-31 h-px bg-border-default" />

      {hasPrimary && (
        <div
          className={cn([
            "grid gap-x-8 gap-y-24 max-sm:grid-cols-1",
            columns === 3 ? "grid-cols-3 max-lg:grid-cols-2" : "grid-cols-2",
          ])}
        >
          {group.items.map((item) => (
            <NavigationItem
              description={item.description}
              href={item.href}
              icon={item.iconName}
              key={item.label}
              label={item.label}
            />
          ))}
        </div>
      )}

      {hasPrimary && hasSecondary && (
        <div className="mx-4 mt-32 mb-31 h-px bg-border-default" />
      )}

      {hasSecondary && (
        <div className="grid grid-cols-3 gap-x-8 gap-y-16 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {group.secondaryItems?.map((item) => (
            <SecondaryItem item={item} key={item.label} />
          ))}
        </div>
      )}
    </section>
  );
}
