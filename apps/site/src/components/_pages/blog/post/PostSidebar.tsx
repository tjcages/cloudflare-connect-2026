import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import CopyLink from "@/components/article/CopyLink";
import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";
import ScrollArea from "@/components/ScrollArea";
import type { IslandProps } from "@/types/island-props";
import { shareLinks } from "./social-links";
import type { TocEntry } from "./toc";

const TICK_COUNT = 77;
const ACTIVE_OFFSET = 120;

interface Props {
  entries: TocEntry[];
  shareUrl: string;
  title: string;
}

function tickAnchors(list: HTMLOListElement) {
  const height = list.offsetHeight;

  if (height === 0) return [];

  return Array.from(list.children, (item) =>
    item instanceof HTMLElement
      ? (item.offsetTop / height) * (TICK_COUNT - 1)
      : 0
  );
}

function scrollStops(entries: TocEntry[], article: Element) {
  const stops = entries.map((entry) => {
    const heading = document.getElementById(entry.id);

    return heading
      ? heading.getBoundingClientRect().top + window.scrollY - ACTIVE_OFFSET
      : 0;
  });

  stops.push(
    article.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
  );

  let previous = Number.NEGATIVE_INFINITY;

  return stops.map((stop) => {
    previous = Math.max(stop, previous + 1);

    return previous;
  });
}

function railPosition(scroll: number, stops: number[], marks: number[]) {
  const last = stops.length - 1;

  if (scroll <= stops[0]) return { active: 0, thumb: marks[0] };
  if (scroll >= stops[last]) return { active: last - 1, thumb: marks[last] };

  let index = 0;

  while (index < last - 1 && scroll >= stops[index + 1]) index++;

  const span = (scroll - stops[index]) / (stops[index + 1] - stops[index]);

  return {
    active: index,
    thumb: marks[index] + span * (marks[index + 1] - marks[index]),
  };
}

function tickWidth(distance: number) {
  return `${Math.max(12, 20 - 4 * distance)}px`;
}

function tickTier(distance: number) {
  return `${Math.min(3, Math.floor(distance))}`;
}

function paintRail(rail: HTMLDivElement, thumb: number) {
  for (let index = 0; index < rail.children.length; index++) {
    const tick = rail.children[index];

    if (!(tick instanceof HTMLElement)) continue;

    const distance = Math.abs(index - thumb);
    const width = tickWidth(distance);
    const tier = tickTier(distance);

    if (tick.style.width !== width) tick.style.width = width;
    if (tick.dataset.tier !== tier) tick.dataset.tier = tier;
  }
}

export default function PostSidebar({
  entries,
  shareUrl,
  title,
}: IslandProps<Props>) {
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const list = listRef.current;
    const article = document.querySelector("article");

    if (entries.length === 0 || !rail || !list || !article) return;

    let frame = 0;
    let stops: number[] = [];
    let marks: number[] = [];

    const update = () => {
      if (marks.length === 0) return;

      const position = railPosition(window.scrollY, stops, marks);

      paintRail(rail, position.thumb);
      setActive(position.active);
    };

    const schedule = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const measure = () => {
      const anchors = tickAnchors(list);

      if (anchors.length === 0) return;

      marks = [...anchors, TICK_COUNT - 1];
      stops = scrollStops(entries, article);

      update();
    };

    const observer = new ResizeObserver(measure);

    observer.observe(article);
    observer.observe(list);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [entries]);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active];
    const viewport = viewportRef.current;

    if (!(item instanceof HTMLElement) || !viewport) return;

    viewport.scrollTo({
      behavior: "smooth",
      top: item.offsetTop + item.offsetHeight / 2 - viewport.clientHeight / 2,
    });
  }, [active]);

  return (
    <aside className="sticky top-160 flex w-280 shrink-0 flex-col gap-40 self-start pr-56">
      {entries.length > 0 && (
        <nav aria-label="On this page" className="flex flex-col gap-8">
          <p className="text-body-x-small text-text-default">On this page</p>

          <div className="relative">
            <ScrollArea
              viewportClassName="max-h-552 py-24"
              viewportRef={viewportRef}
            >
              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 flex w-32 flex-col justify-between py-10"
                  ref={railRef}
                >
                  {Array.from({ length: TICK_COUNT }, (_, index) => (
                    <span
                      className="h-px transition-colors duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)] data-[tier=0]:bg-neutral-12 data-[tier=1]:bg-neutral-9 data-[tier=2]:bg-neutral-7 data-[tier=3]:bg-neutral-6"
                      data-tier={tickTier(index)}
                      key={index}
                      style={{ width: tickWidth(index) }}
                    />
                  ))}
                </div>

                <ol
                  className="relative ml-36 flex w-188 flex-col gap-20"
                  ref={listRef}
                >
                  {entries.map((entry, index) => (
                    <li
                      className={entry.level === 3 ? "pl-12" : ""}
                      key={entry.id}
                    >
                      <a
                        className={cn(
                          "block text-body-x-small transition-colors outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]",
                          index === active
                            ? "text-text-base"
                            : "text-text-default hover:text-text-base"
                        )}
                        href={`#${entry.id}`}
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollArea>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-background-base to-transparent" />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background-base to-transparent" />
          </div>
        </nav>
      )}

      <div className="flex flex-col gap-12">
        <p className="text-body-x-small text-text-default">Discuss online</p>

        <div className="flex flex-wrap gap-4">
          {shareLinks(shareUrl, title).map(({ icon, label, href }) => (
            <Button
              aria-label={label}
              href={href}
              key={icon}
              rel="noreferrer"
              size="default"
              target="_blank"
              variant="ghost"
            >
              <Icon name={icon} size={20} />
            </Button>
          ))}

          <CopyLink />
        </div>
      </div>
    </aside>
  );
}
