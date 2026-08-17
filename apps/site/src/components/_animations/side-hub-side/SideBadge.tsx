import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import type { IslandProps } from "@/types/island-props";

interface SideBadgeProps {
  count: number;
  side: "L" | "R";
}

export default function SideBadge({
  count,
  side,
}: IslandProps<SideBadgeProps>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(count);

  useIllustrationEvent<{ count: number }>(
    rootRef,
    `side-badge:${side}`,
    (detail) => setValue(detail.count)
  );

  return (
    <div className="size-full" ref={rootRef}>
      <AnimatePresence initial={false} mode="popLayout">
        {value > 0 ? (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="flex-center size-full rounded-full bg-background-accent-warning text-label-tiny text-text-inverse"
            exit={{
              opacity: 0,
              scale: 0.9,
              transition: { duration: 0.18, ease: [0.165, 0.84, 0.44, 1] },
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            key="badge"
            transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(1px)" }}
                initial={{ opacity: 0, filter: "blur(1px)" }}
                key={value}
                transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
              >
                {value}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
