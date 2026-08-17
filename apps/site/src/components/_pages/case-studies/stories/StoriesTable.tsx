import cn from "classnames";
import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { resolveZoom } from "@/utils/zoom";
import { stories, storyFacets } from "./data";
import FacetSelect from "./FacetSelect";
import {
  emptyFilters,
  facetOptions,
  filterStories,
  type StoryFilters,
  toggleFacetValue,
} from "./filter";
import StoryRow from "./StoryRow";

export default function StoriesTable() {
  const [filters, setFilters] = useState<StoryFilters>(emptyFilters);
  const [limit, setLimit] = useState(10);
  const [pinned, setPinned] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | undefined;
    let resizeFrame = 0;

    const observe = () => {
      observer?.disconnect();
      const pinOffset = 80 * resolveZoom(document.documentElement);

      observer = new IntersectionObserver(
        ([entry]) => {
          setPinned(entry.boundingClientRect.top < pinOffset);
        },
        { rootMargin: `-${pinOffset}px 0px 0px` }
      );
      observer.observe(sentinel);
    };

    const handleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(observe);
    };

    observe();
    window.addEventListener("resize", handleResize);

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const applyFilters = (next: StoryFilters) => {
    setFilters(next);
    setLimit(10);
  };

  const visible = filterStories(stories, filters);
  const shown = visible.slice(0, limit);
  const selectedValues = Object.values(filters).flat();

  return (
    <div className="pt-40 pb-24">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          ref={sentinelRef}
        />
      </div>

      <div className="pointer-events-none sticky top-80 z-20 h-120">
        <div
          className={cn(
            "pointer-events-auto relative flex items-center transition-[height] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)] after:inside-border-x after:inside-border-b after:border-border-default after:transition-opacity after:duration-200",
            pinned ? "h-80 after:opacity-100" : "h-120 after:opacity-0"
          )}
        >
          <div className="absolute inset-x-px inset-y-0 bg-background-base" />

          <div
            className={cn(
              "absolute top-0 -bottom-4 centering-w-[100vw] bg-background-base transition-opacity duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
              pinned ? "opacity-100" : "opacity-0"
            )}
          />

          <div className="relative flex w-full items-center gap-12 px-80">
            <p className="w-112 text-body-x-small text-text-default">
              Filter by:
            </p>

            {storyFacets.map((facet) => (
              <FacetSelect
                icon={facet.icon}
                key={facet.key}
                label={facet.label}
                onToggleValue={(value) =>
                  applyFilters(toggleFacetValue(filters, facet.key, value))
                }
                options={facetOptions(stories, facet.key)}
                panelWidthClass={facet.panelWidthClass}
                plural={facet.plural}
                selected={filters[facet.key]}
              />
            ))}
          </div>
        </div>
      </div>

      <div aria-live="polite" className="sr-only" role="status">
        {selectedValues.length > 0
          ? `${visible.length} ${visible.length === 1 ? "story" : "stories"} found for ${selectedValues.join(", ")}`
          : `${stories.length} stories shown`}
      </div>

      <div className="relative">
        <AnimatePresence initial={false}>
          {shown.map((story) => (
            <StoryRow key={story.href} story={story} />
          ))}

          {visible.length === 0 && (
            <motion.div
              animate={{ opacity: 1, height: 216 }}
              className="flex flex-col justify-end overflow-clip"
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, height: 0 }}
              key="empty"
              transition={{
                duration: 0.25,
                ease: cubicBezier(0.165, 0.84, 0.44, 1),
              }}
            >
              <div className="relative flex-center h-216 shrink-0 flex-col gap-24 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border-default">
                <p className="text-body-large text-text-muted">
                  No stories match your filters.
                </p>

                <Button
                  onClick={() => applyFilters(emptyFilters)}
                  size="default"
                  variant="secondary"
                >
                  <span>Clear filters</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 top-0 z-10 h-px bg-border-default" />

        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-border-default" />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {visible.length > limit && (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex justify-center pt-40"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="load-more"
            transition={{
              duration: 0.18,
              ease: cubicBezier(0.165, 0.84, 0.44, 1),
            }}
          >
            <Button
              className="px-18"
              onClick={() => setLimit(limit + 10)}
              variant="secondary"
            >
              <span>Load more</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
