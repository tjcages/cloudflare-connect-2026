import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { useState } from "react";
import Button from "@/components/Button";
import type { IslandProps } from "@/types/island-props";
import type { ArchiveEntry } from "./data";

function ArchiveRow({ entry }: { entry: ArchiveEntry }) {
  return (
    <a
      className="group relative flex h-72 shrink-0 items-center gap-24 bg-background-base px-80 max-lg:gap-12 max-lg:px-24 transition-colors duration-150 outline-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border-default hover:bg-background-surface focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
      href={`/blog/${entry.slug}`}
    >
      <span className="min-w-0 flex-1 truncate text-label-x-small text-text-base transition-colors duration-150 group-hover:text-orange-900">
        {entry.title}
      </span>

      <span className="flex shrink-0 items-center gap-10 text-body-x-small whitespace-nowrap">
        <span className="text-text-muted max-sm:hidden">{entry.byline}</span>

        <span className="text-text-faint max-sm:hidden">·</span>

        <span className="text-text-muted">{entry.date}</span>
      </span>
    </a>
  );
}

export default function ArchiveTable({
  entries,
  step = 12,
}: IslandProps<{ entries: ArchiveEntry[]; step?: number }>) {
  const [limit, setLimit] = useState(step);

  const shown = entries.slice(0, limit);

  return (
    <div>
      <div className="relative">
        {shown.map((entry, index) =>
          index < step ? (
            <ArchiveRow entry={entry} key={entry.slug} />
          ) : (
            <motion.div
              animate={{ height: 72, opacity: 1 }}
              className="flex flex-col justify-end overflow-clip"
              initial={{ height: 0, opacity: 0 }}
              key={entry.slug}
              transition={{
                duration: 0.25,
                ease: cubicBezier(0.165, 0.84, 0.44, 1),
              }}
            >
              <ArchiveRow entry={entry} />
            </motion.div>
          )
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-border-default" />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {entries.length > limit && (
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
              onClick={() => setLimit(limit + step)}
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
