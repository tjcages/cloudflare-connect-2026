import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import cn from "classnames";
import { AnimatePresence, cubicBezier, motion } from "motion/react";
import type { FC, SVGProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScrollArea from "@/components/ScrollArea";
import Icon from "@/components/icon/Icon";
import { setPageOverlayOwner } from "@/utils/page-overlay";
import { pushRecent, readRecent, type RecentEntry } from "./recent";
import { searchCommandMenu } from "./search";
import { commandMenuSuggestions } from "./suggestions";
import type {
  CommandMenuGroup,
  CommandMenuItem,
  CommandMenuSearchRecord,
  CommandMenuSearchResult,
} from "./types";

type CaseStudyLogos = Record<string, FC<SVGProps<SVGSVGElement>>>;

type SearchState = "idle" | "loading" | "success" | "error";
type LocalSearchState = "idle" | "ready" | "error";
type LocalSearch = (typeof import("./local-search"))["searchLocalCommandMenu"];

const suggestionItems: CommandMenuItem[] = [...commandMenuSuggestions];
const suggestionGroups: CommandMenuGroup[] = [
  { id: "suggestions", label: "Suggestions", items: suggestionItems },
];
const isCardKind = (item: CommandMenuItem) =>
  item.kind === "post" || item.kind === "case-study";
const autoHighlightAlways = "always" as unknown as boolean;
const commandMenuTransition = {
  duration: 0.108,
  ease: cubicBezier(0.165, 0.84, 0.44, 1),
};

const hasModifiedClick = (
  event: Pick<React.MouseEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">
) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

const remoteFallbackItem = (
  result: CommandMenuSearchResult
): CommandMenuSearchRecord => ({
  ...result,
  groupId: "posts",
  groupLabel: "Posts",
  groupOrder: 200,
  kind: "post",
  keywords: [],
});

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative flex h-24 w-36 items-center justify-center rounded-full text-body-tiny text-text-default before:inner-border before:border-border-muted">
      {children}
    </span>
  );
}

function RowMedia({ item }: { item: CommandMenuItem }) {
  if (item.cover) {
    return (
      <img
        alt=""
        className="size-full bg-background-muted object-cover"
        loading="lazy"
        src={item.cover}
      />
    );
  }

  if (item.logo) {
    return (
      <item.logo aria-hidden className={cn(["h-24 w-40", item.logoClass])} />
    );
  }

  return (
    <span className="flex size-full items-center justify-center bg-background-muted">
      <Icon className="text-icon-subtle" name={item.iconName} size={20} />
    </span>
  );
}

function EmptyState({
  localSearchUnavailable,
  state,
}: {
  localSearchUnavailable: boolean;
  state: SearchState;
}) {
  if (state === "loading") {
    return (
      <div className="flex items-center gap-8">
        <Icon
          className="animate-spin text-icon-muted [animation-duration:0.7s] [animation-timing-function:steps(8)]"
          color="orange"
          name="loader"
          size={20}
          variant="duo"
        />
        <span>Almost there...</span>
      </div>
    );
  }

  if (state === "error") return <>Search failed. Try another search.</>;
  if (localSearchUnavailable && state === "success")
    return <>Local pages are unavailable. Reload to restore them.</>;
  if (state === "success") return <>No results found.</>;
  return null;
}

export default function CommandMenu({
  onBeforeOpen,
}: {
  onBeforeOpen: (activeElement: HTMLElement | null) => HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localSearch, setLocalSearch] = useState<LocalSearch | null>(null);
  const [localSearchState, setLocalSearchState] =
    useState<LocalSearchState>("idle");
  const [caseStudyLogos, setCaseStudyLogos] = useState<CaseStudyLogos | null>(
    null
  );
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [suggestionNavigationStarted, setSuggestionNavigationStarted] =
    useState(false);
  const [resettingSuggestions, setResettingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const localSearchRequestRef = useRef(false);
  const remoteCacheRef = useRef(new Map<string, CommandMenuSearchResult[]>());
  const remoteCorpusRef = useRef(new Map<string, CommandMenuSearchResult>());
  const viewportRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const onPopupMount = useCallback((element: HTMLDivElement | null) => {
    if (element) setResettingSuggestions(true);
  }, []);

  const hasSearchQuery = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const searchGroups = useMemo(() => {
    if (localSearch) {
      return localSearch(query, [...remoteCorpusRef.current.values()]);
    }

    const remoteResults = remoteCacheRef.current.get(normalizedQuery) ?? [];
    return remoteResults.length > 0
      ? [
          {
            id: "posts",
            label: "Posts",
            items: remoteResults.map(remoteFallbackItem),
          },
        ]
      : [];
  }, [localSearch, normalizedQuery, query, remoteRevision]);
  const recentGroup: CommandMenuGroup | null = useMemo(() => {
    if (recentEntries.length === 0) return null;

    return {
      id: "recent",
      label: "Recent",
      items: recentEntries.map((entry) => ({
        id: `recent:${entry.href}`,
        label: entry.label,
        description: entry.description,
        href: entry.href,
        iconName: entry.iconName,
        kind: entry.kind,
        cover: entry.cover,
        logo: entry.logoSlug ? caseStudyLogos?.[entry.logoSlug] : undefined,
        logoClass: entry.logoSlug ? `story-brand-${entry.logoSlug}` : undefined,
      })),
    };
  }, [caseStudyLogos, recentEntries]);

  const renderedGroups: CommandMenuGroup[] = hasSearchQuery
    ? searchGroups
    : recentGroup
      ? [recentGroup, ...suggestionGroups]
      : suggestionGroups;
  const renderedItems = renderedGroups.flatMap((group) => group.items);
  const rootItems = resettingSuggestions ? [] : renderedItems;
  const autoHighlight =
    hasSearchQuery || suggestionNavigationStarted ? autoHighlightAlways : false;

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setQuery("");
    setSearchState("idle");
    setSuggestionNavigationStarted(false);
    setResettingSuggestions(false);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, []);

  const setMenuOpen = useCallback((nextOpen: boolean) => {
    openRef.current = nextOpen;
    setOpen(nextOpen);
  }, []);

  useEffect(() => {
    setPageOverlayOwner("command-menu", open);
    return () => setPageOverlayOwner("command-menu", false);
  }, [open]);

  useEffect(() => {
    if (!open || localSearch || localSearchRequestRef.current) return;

    localSearchRequestRef.current = true;
    void Promise.all([
      import("./local-search"),
      import("@/components/_pages/case-studies/logos/logos"),
    ])
      .then(([search, logos]) => {
        setLocalSearch(() => search.searchLocalCommandMenu);
        setCaseStudyLogos(logos.caseStudyLogos);
        setLocalSearchState("ready");
      })
      .catch(() => {
        setLocalSearchState("error");
      });
  }, [localSearch, open]);

  useEffect(() => {
    if (open) setRecentEntries(readRecent());
  }, [open]);

  useEffect(() => {
    if (!open || document.querySelector("[data-command-menu-preconnect]")) {
      return;
    }

    const link = document.createElement("link");
    link.crossOrigin = "anonymous";
    link.dataset.commandMenuPreconnect = "";
    link.href = "https://ai-search.blog.cloudflare.com";
    link.rel = "preconnect";
    document.head.appendChild(link);
  }, [open]);

  useEffect(() => {
    if (resettingSuggestions) setResettingSuggestions(false);
  }, [resettingSuggestions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }

      event.preventDefault();
      if (openRef.current) return;

      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      returnFocusRef.current = onBeforeOpen(activeElement) ?? activeElement;
      setMenuOpen(true);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onBeforeOpen, setMenuOpen]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setMenuOpen(false);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [setMenuOpen]);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (!open || !hasSearchQuery) {
      setSearchState("idle");
      return;
    }

    if (remoteCacheRef.current.has(normalizedQuery)) {
      setSearchState("success");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setSearchState("loading");

    const timeout = window.setTimeout(async () => {
      try {
        const nextResults = await searchCommandMenu(
          query.trim(),
          controller.signal
        );
        if (controller.signal.aborted) return;
        remoteCacheRef.current.set(normalizedQuery, nextResults);
        for (const result of nextResults) {
          remoteCorpusRef.current.set(result.href, result);
        }
        setRemoteRevision((revision) => revision + 1);
        setSearchState("success");
      } catch {
        if (controller.signal.aborted) return;
        setSearchState("error");
      }
    }, 120);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [hasSearchQuery, normalizedQuery, open, query]);

  const announcement = useMemo(() => {
    if (!hasSearchQuery) return "Suggestions available.";
    if (searchState === "loading" && renderedItems.length > 0)
      return `${renderedItems.length} local results available. Searching older posts.`;
    if (searchState === "loading") return "Searching.";
    if (searchState === "error" && renderedItems.length > 0)
      return `${renderedItems.length} local results available. Older posts are unavailable.`;
    if (searchState === "error") return "Search failed.";
    if (localSearchState === "error" && searchState === "success") {
      if (renderedItems.length > 0)
        return `${renderedItems.length} older posts available. Local pages are unavailable.`;
      return "Local pages are unavailable. Reload to restore them.";
    }
    if (searchState === "success" && renderedItems.length === 0)
      return "No results found.";
    if (searchState === "success")
      return `${renderedItems.length} search results available.`;
    return "";
  }, [hasSearchQuery, localSearchState, renderedItems.length, searchState]);

  let itemIndex = 0;

  return (
    <Combobox.Root<CommandMenuItem>
      autoHighlight={autoHighlight}
      filter={null}
      inline
      inputValue={query}
      isItemEqualToValue={(item, value) => item.id === value.id}
      itemToStringLabel={(item) => item.label}
      items={rootItems}
      loopFocus
      onInputValueChange={(nextQuery) => {
        if (hasSearchQuery && !nextQuery.trim()) {
          setSuggestionNavigationStarted(false);
          setResettingSuggestions(true);
          if (viewportRef.current) viewportRef.current.scrollTop = 0;
        }
        setQuery(nextQuery);
      }}
      onItemHighlighted={(item) => {
        if (!hasSearchQuery && item) setSuggestionNavigationStarted(true);
      }}
      onOpenChange={setMenuOpen}
      onValueChange={(value, details) => {
        if (!value || details.reason !== "item-press") return;
        pushRecent(value);
        setMenuOpen(false);
        window.location.assign(value.href);
      }}
      open={open}
      openOnInputClick={false}
      value={null}
    >
      <Dialog.Root onOpenChange={setMenuOpen} open={open}>
        <AnimatePresence
          onExitComplete={() => {
            if (!openRef.current) reset();
          }}
        >
          {open && (
            <Dialog.Portal keepMounted>
              <Dialog.Backdrop
                className="fixed inset-0 z-80 bg-overlay-darker-loud backdrop-blur-[10px]"
                render={
                  <motion.div
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    transition={commandMenuTransition}
                  />
                }
              />
              <Dialog.Popup
                className="fixed top-1/2 left-1/2 z-80 flex h-480 max-h-[calc(100dvh-20px)] w-640 max-w-[calc(100vw-20px)] -translate-x-1/2 -translate-y-1/2 flex-col bg-background-base shadow-elevation-default outline-none max-[639px]:h-[calc(100dvh-20px)]"
                finalFocus={() => returnFocusRef.current ?? false}
                initialFocus={inputRef}
                ref={onPopupMount}
                render={
                  <motion.div
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={{ opacity: 0, transform: "translateY(8px)" }}
                    initial={{ opacity: 0, transform: "translateY(8px)" }}
                    transition={commandMenuTransition}
                  />
                }
              >
                <Dialog.Title className="sr-only">
                  Search posts and pages
                </Dialog.Title>
                <Dialog.Close className="sr-only">Close</Dialog.Close>

                <div className="relative flex h-64 shrink-0 items-center px-20 before:inner-border-b before:border-border-muted">
                  <span className="flex size-24 shrink-0 items-center justify-center">
                    <Icon
                      className="text-icon-muted"
                      color="orange"
                      name="magnifying-glass-2"
                      size={20}
                      variant="duo"
                    />
                  </span>
                  <Combobox.Input
                    aria-label="Search"
                    autoComplete="off"
                    className="h-24 min-w-0 flex-1 px-6 py-2 text-body-x-small text-text-base outline-none placeholder:text-text-muted"
                    placeholder="Search..."
                    ref={inputRef}
                    spellCheck={false}
                  />
                  <span aria-hidden className="size-24 shrink-0" />
                </div>

                <ScrollArea
                  className="min-h-0 flex-1"
                  contentClassName="w-full min-w-0!"
                  verticalScrollbarClassName="top-[0px]! right-[5px]! bottom-[0px]! w-[5px]! opacity-100!"
                  verticalThumbClassName="mt-107 h-112! w-[5px]! rounded-[4px]! bg-darker/8! transition-none max-[639px]:mt-0"
                  viewportClassName="h-full scroll-py-16"
                  viewportRef={viewportRef}
                >
                  <Combobox.Empty className="pointer-events-none absolute inset-0 flex items-center justify-center px-20 text-body-x-small text-text-muted">
                    <EmptyState
                      localSearchUnavailable={localSearchState === "error"}
                      state={hasSearchQuery ? searchState : "idle"}
                    />
                  </Combobox.Empty>
                  <Combobox.List
                    aria-busy={hasSearchQuery && searchState === "loading"}
                    aria-label={
                      hasSearchQuery ? "Search results" : "Suggestions"
                    }
                    className="w-full p-4 outline-none"
                  >
                    {renderedGroups.map((group) => (
                      <Combobox.Group key={group.id}>
                        <Combobox.GroupLabel
                          className={cn(
                            "flex items-center px-16 text-body-x-small text-text-muted",
                            hasSearchQuery ? "h-32" : "h-44"
                          )}
                        >
                          {group.label}
                        </Combobox.GroupLabel>
                        {group.items.map((item) => {
                          const index = itemIndex;
                          itemIndex += 1;

                          const card = isCardKind(item);

                          return (
                            <Combobox.Item
                              className={cn([
                                "group flex w-full gap-16 px-20 text-body-x-small outline-none not-data-highlighted:hover:bg-background-ghost data-highlighted:bg-background-faint",
                                card
                                  ? "items-start py-14"
                                  : "h-52 items-center",
                              ])}
                              index={index}
                              key={`${resettingSuggestions ? "reset-" : ""}${item.id}`}
                              onClick={(event) => {
                                event.preventBaseUIHandler();
                                if (hasModifiedClick(event)) return;
                                pushRecent(item);
                                setMenuOpen(false);
                              }}
                              render={<a href={item.href} tabIndex={-1} />}
                              value={item}
                            >
                              {card ? (
                                <>
                                  <span className="relative flex h-40 w-64 shrink-0 items-center justify-center overflow-clip">
                                    <RowMedia item={item} />
                                  </span>
                                  <span className="flex min-w-0 flex-1 flex-col gap-4">
                                    <span className="truncate text-text-base">
                                      {item.label}
                                    </span>
                                    <span className="line-clamp-2 text-body-tiny text-text-muted">
                                      {item.description}
                                    </span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Icon
                                    color="orange"
                                    name={item.iconName}
                                    size={20}
                                    variant="duo"
                                  />
                                  <span className="flex min-w-0 flex-1 items-center gap-12">
                                    <span className="max-w-1/2 shrink-0 truncate text-text-base">
                                      {item.label}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-text-muted">
                                      {item.description}
                                    </span>
                                  </span>
                                </>
                              )}
                            </Combobox.Item>
                          );
                        })}
                      </Combobox.Group>
                    ))}
                  </Combobox.List>
                </ScrollArea>

                <div aria-live="polite" className="sr-only" role="status">
                  {announcement}
                </div>

                <div className="before:inner-border-t relative flex h-56 shrink-0 items-center justify-end px-20 before:border-border-muted max-[639px]:hidden">
                  <div className="flex items-center gap-16">
                    <div className="flex items-center gap-10">
                      <span className="text-label-tiny text-text-base">
                        Navigate
                      </span>
                      <span className="flex items-center gap-6">
                        <ShortcutKey>↓</ShortcutKey>
                        <ShortcutKey>↑</ShortcutKey>
                      </span>
                    </div>
                    <span className="relative h-24 w-12 before:absolute before:top-4 before:left-1/2 before:h-16 before:w-px before:-translate-x-1/2 before:bg-border-dashed" />
                    <div className="flex items-center gap-10">
                      <span className="text-label-tiny text-text-base">
                        Select
                      </span>
                      <ShortcutKey>↵</ShortcutKey>
                    </div>
                  </div>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </Combobox.Root>
  );
}
