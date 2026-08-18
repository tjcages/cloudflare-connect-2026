import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import Dropdown from "@/components/dropdown/Dropdown";
import DropdownLink from "@/components/dropdown/DropdownLink";
import Icon from "@/components/icon/Icon";
import type { IslandProps } from "@/types/island-props";
import {
  archiveFor,
  blogDocumentTitle,
  blogTagFromPath,
  blogTagPath,
  publishBlogTagView,
  TAG_GRID_SIZE,
} from "./view";

export type FilterTag = { slug: string; label: string; count: number };
export type FilterRecord = { slug: string; text: string; tags: string[] };

const PINNED_SLUGS = [
  "ai",
  "developers",
  "cloudflare-radar",
  "product-news",
  "security",
];

const isPlainClick = (event: React.MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export default function FilterBar({
  documentTag,
  records,
  tags,
}: IslandProps<{
  documentTag: string | null;
  records: FilterRecord[];
  tags: FilterTag[];
}>) {
  const [tag, setTag] = useState(documentTag);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const activeKey = tag ?? "all";

  const bySlug = new Map(tags.map((entry) => [entry.slug, entry]));
  const pinned = PINNED_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (entry): entry is FilterTag => Boolean(entry)
  );
  const active = tag === null ? undefined : bySlug.get(tag);
  const chips =
    active && !pinned.includes(active) ? [...pinned, active] : pinned;
  const overflow = tags
    .filter((entry) => !chips.includes(entry))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const trimmed = query.trim();
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = tokens.length > 0;
  const tagged = records.filter(
    (record) => tag === null || record.tags.includes(tag)
  );
  const visibleSlugs = searching
    ? tagged
        .filter((record) =>
          tokens.every((token) => record.text.includes(token))
        )
        .map((record) => record.slug)
    : tagged.slice(0, TAG_GRID_SIZE).map((record) => record.slug);
  const visibleKey = visibleSlugs.join(",");

  const showDefault = !searching && tag === documentTag;
  const showArchive = !searching && archiveFor(records, tag).length > 0;

  const openTag = (event: React.MouseEvent, next: FilterTag | null) => {
    if (!isPlainClick(event)) return;

    const slug = next?.slug ?? null;

    if (slug === null && documentTag !== null) return;

    event.preventDefault();

    if (slug === tag) return;

    history.pushState({ blogTag: slug }, "", blogTagPath(slug));
    setTag(slug);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    const label = tags.find((entry) => entry.slug === tag)?.label ?? null;

    publishBlogTagView({ slug: tag, label });
    document.title = blogDocumentTitle(label);

    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );

    if (canonical) {
      canonical.href = new URL(`${blogTagPath(tag)}/`, location.href).href;
    }
  }, [tag, tags]);

  useEffect(() => {
    const onPopState = () => {
      const next = blogTagFromPath(location.pathname);

      if (next === null && documentTag !== null) {
        location.reload();
        return;
      }

      setTag(next);
      window.scrollTo({ top: 0, behavior: "instant" });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [documentTag]);

  useEffect(() => {
    const page = rootRef.current?.closest("[data-blog-page]");
    if (!page) return;

    const shown = new Set(visibleSlugs);

    for (const region of page.querySelectorAll<HTMLElement>(
      "[data-blog-default]"
    )) {
      region.hidden = !showDefault;
    }

    for (const region of page.querySelectorAll<HTMLElement>(
      "[data-blog-results]"
    )) {
      region.hidden = showDefault;
    }

    for (const region of page.querySelectorAll<HTMLElement>(
      "[data-blog-archive]"
    )) {
      region.hidden = !showArchive;
    }

    for (const card of page.querySelectorAll<HTMLElement>("[data-post-slug]")) {
      card.hidden = !showDefault && !shown.has(card.dataset.postSlug ?? "");
    }

    const empty = page.querySelector<HTMLElement>("[data-blog-empty]");
    if (empty) empty.hidden = !searching || shown.size > 0;

    const echo = page.querySelector<HTMLElement>("[data-blog-term]");
    if (echo) echo.textContent = trimmed;
  }, [showArchive, showDefault, searching, trimmed, visibleKey]);

  return (
    <div
      className="flex h-40 items-center justify-between max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-16"
      ref={rootRef}
    >
      <div className="flex items-center gap-4 max-lg:flex-wrap">
        <Button
          className={cn(
            "shrink-0 [&>span]:transition-[padding] [&>span]:duration-250 [&>span]:ease-[cubic-bezier(0.165,0.84,0.44,1)]",
            activeKey === "all" && "bg-background-faint [&>span]:px-8"
          )}
          href="/blog"
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) =>
            openTag(event, null)
          }
          variant="ghost"
        >
          <span className="whitespace-nowrap">All</span>
        </Button>

        {chips.map((entry) => (
          <Button
            className={cn(
              "shrink-0 [&>span]:transition-[padding] [&>span]:duration-250 [&>span]:ease-[cubic-bezier(0.165,0.84,0.44,1)]",
              entry.slug === activeKey && "bg-background-faint [&>span]:px-8"
            )}
            href={blogTagPath(entry.slug)}
            key={entry.slug}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) =>
              openTag(event, entry)
            }
            variant="ghost"
          >
            <span className="whitespace-nowrap">{entry.label}</span>
          </Button>
        ))}

        <Dropdown
          label="More tags"
          panelClassName="w-280"
          trigger={
            <Button className="shrink-0" type="button" variant="ghost">
              <span className="whitespace-nowrap">More</span>

              <Icon
                className="transition-transform duration-150 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-popup-open:rotate-180"
                name="chevron-down-small"
              />
            </Button>
          }
        >
          {overflow.map((entry) => (
            <DropdownLink
              className="justify-between"
              href={blogTagPath(entry.slug)}
              key={entry.slug}
              onClick={(event) => openTag(event, entry)}
            >
              <span className="truncate px-4">{entry.label}</span>

              <span className="shrink-0 px-4 text-body-tiny text-text-muted">
                {entry.count}
              </span>
            </DropdownLink>
          ))}
        </Dropdown>
      </div>

      <div className="flex items-center gap-12">
        <div className="flex h-40 w-280 items-center gap-4 rounded-full bg-background-base p-7 shadow-input-rest transition-shadow focus-within:shadow-input-active not-focus-within:hover:shadow-input-hover max-lg:w-auto max-lg:flex-1">
          <Icon
            className="mx-2 text-icon-muted"
            name="magnifying-glass-2"
            size={20}
          />

          <input
            aria-label="Search the blog"
            className="min-w-0 flex-1 px-6 py-2 text-body-x-small text-text-base outline-none placeholder:text-text-muted"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder="Search..."
            type="text"
            value={query}
          />
        </div>

        <Button
          aria-label="Blog RSS feed"
          className="size-40 shrink-0"
          href="/blog/rss.xml"
          size="default"
          variant="secondary"
        >
          <Icon name="rss" size={20} />
        </Button>
      </div>

      <div aria-live="polite" className="sr-only" role="status">
        {searching
          ? `${visibleSlugs.length} ${visibleSlugs.length === 1 ? "post" : "posts"} found for “${trimmed}”`
          : ""}
      </div>
    </div>
  );
}
