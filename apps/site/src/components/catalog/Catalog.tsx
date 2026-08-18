import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import type { IslandProps } from "@/types/island-props";
import { resolveZoom } from "@/utils/zoom";
import SearchInput from "./SearchInput";
import GroupCard from "./GroupCard";
import CategorySidebar from "./CategorySidebar";
import { buildCatalogSearch, filterGroups, parseCatalogParams } from "./filter";
import type { CatalogGroup } from "./types";

export default function Catalog({
  groups,
  columns,
  noun,
  searchPlaceholder,
  categoriesLabel,
}: IslandProps<{
  groups: CatalogGroup[];
  columns: 2 | 3;
  noun: { singular: string; plural: string };
  searchPlaceholder: string;
  categoriesLabel: string;
}>) {
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState(groups[0].slug);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searching = query.trim().length > 0;
  const filteredGroups = filterGroups(groups, query);
  const resultCount = searching
    ? filteredGroups.reduce(
        (total, group) =>
          total + group.items.length + (group.secondaryItems?.length ?? 0),
        0
      )
    : null;
  const counts = (() => {
    if (!searching) return null;
    const bySlug: Record<string, number> = {};
    for (const group of groups) bySlug[group.slug] = 0;
    for (const group of filteredGroups) {
      bySlug[group.slug] =
        group.items.length + (group.secondaryItems?.length ?? 0);
    }
    return bySlug;
  })();

  const spySuppressedUntil = useRef(0);
  const pendingSpyTarget = useRef<string | null>(null);

  const visibleSlugs = filteredGroups.map((g) => g.slug);
  const visibleSlugsKey = visibleSlugs.join(",");

  useEffect(() => {
    const sections = visibleSlugs
      .map((slug) => document.getElementById(slug))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      () => {
        const zoom = resolveZoom(document.documentElement);
        if (pendingSpyTarget.current) {
          const target = document.getElementById(pendingSpyTarget.current);
          const arrived =
            target &&
            Math.abs(target.getBoundingClientRect().top / zoom - 80) < 56;
          if (!arrived && Date.now() < spySuppressedUntil.current) return;
          pendingSpyTarget.current = null;
        }

        const spyLine = 136;
        let current = sections[0].id;
        for (const section of sections) {
          if (section.getBoundingClientRect().top / zoom <= spyLine)
            current = section.id;
        }
        setActiveSlug(current);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0, 0.1, 0.5, 1] }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [visibleSlugsKey]);

  const scrollToGroup = (slug: string, behavior: ScrollBehavior) => {
    const el = document.getElementById(slug);
    if (!el) return;
    pendingSpyTarget.current = slug;
    spySuppressedUntil.current = Date.now() + 3000;
    setActiveSlug(slug);
    el.scrollIntoView({ behavior, block: "start" });
  };

  const categoryParam = useRef<string | null>(null);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  useEffect(() => {
    const slugs = groups.map((g) => g.slug);
    const { category, q } = parseCatalogParams(window.location.search, slugs);
    if (q) setQuery(q);
    if (category) {
      categoryParam.current = category;
      setPendingScroll(category);
    }
  }, []);

  useEffect(() => {
    if (!pendingScroll) return;
    scrollToGroup(pendingScroll, "auto");
    setPendingScroll(null);
  }, [pendingScroll]);

  const writeUrl = (category: string | null, q: string) => {
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${buildCatalogSearch(category, q)}${window.location.hash}`
    );
  };
  const writeUrlDebounced = useDebounceCallback(writeUrl, 200);

  useEffect(() => {
    return () => writeUrlDebounced.cancel();
  }, [writeUrlDebounced]);

  return (
    <>
      <div className="relative mx-auto max-w-1200 before:inside-border-b before:border-border-default">
        <div className="mx-auto flex w-640 flex-col items-center pt-40 max-lg:w-full max-lg:px-24">
          <SearchInput
            ariaLabel={`Search ${noun.plural}`}
            inputRef={searchInputRef}
            onChange={(value) => {
              setQuery(value);
              writeUrlDebounced(categoryParam.current, value);
            }}
            placeholder={searchPlaceholder}
            value={query}
          />
        </div>

        <div className="relative h-80" />
      </div>

      <div aria-live="polite" className="sr-only" role="status">
        {searching
          ? `${resultCount} ${resultCount === 1 ? noun.singular : noun.plural} found for “${query.trim()}”`
          : ""}
      </div>

      <div className="relative mx-auto flex max-w-1200 items-start max-lg:flex-col">
        <CategorySidebar
          activeSlug={activeSlug}
          ariaLabel={categoriesLabel}
          counts={counts}
          groups={groups.map(({ label, slug }) => ({
            label,
            slug,
          }))}
          onSelect={(slug) => {
            categoryParam.current = slug;
            writeUrlDebounced.cancel();
            scrollToGroup(slug, "smooth");
            writeUrl(slug, query);
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-80 bg-background-surface max-lg:w-full">
          {filteredGroups.map((group) => (
            <GroupCard columns={columns} group={group} key={group.slug} />
          ))}

          {filteredGroups.length === 0 && (
            <div className="flex-center min-h-320 text-body-large text-text-muted">
              No {noun.plural} found for &ldquo;{query.trim()}&rdquo;
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto h-80 max-w-1200 bg-background-surface before:inside-border-b before:border-border-muted" />

      <div className="h-80" />
    </>
  );
}
