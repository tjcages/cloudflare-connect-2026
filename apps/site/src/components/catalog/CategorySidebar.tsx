import CategoryList from "@/components/category-list/CategoryList";

export default function CategorySidebar({
  groups,
  activeSlug,
  counts,
  onSelect,
  ariaLabel,
}: {
  groups: { label: string; slug: string }[];
  activeSlug: string;
  counts: Record<string, number> | null;
  onSelect: (slug: string) => void;
  ariaLabel: string;
}) {
  const items = groups.map((group) => {
    const count = counts?.[group.slug];

    return {
      key: group.slug,
      label: group.label,
      count:
        counts !== null && count !== undefined && count > 0 ? count : undefined,
      disabled: counts !== null && count === 0,
    };
  });

  return (
    <aside className="relative w-300 shrink-0 self-stretch before:inside-border-r before:inside-border-b before:border-border-muted">
      <nav aria-label={ariaLabel} className="sticky top-80 flex flex-col p-40">
        <div className="mb-16 px-12 text-body-x-small text-text-muted">
          Browse by category
        </div>

        <CategoryList
          activeIndex={groups.findIndex((group) => group.slug === activeSlug)}
          items={items}
          onSelect={(index) => onSelect(groups[index].slug)}
        />
      </nav>
    </aside>
  );
}
