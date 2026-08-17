import cn from "classnames";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  type Variants,
} from "motion/react";
import { useState } from "react";

const menuItemVariants = (
  index: number,
  direction: 1 | -1,
  xMultiplier = 1
): Variants => ({
  visible: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.22,
      ease: cubicBezier(0.165, 0.84, 0.44, 1),
      delay: 0.015 + index * 0.02,
    },
  },
  exit: (exitDirection: number) => ({
    x: -8 * exitDirection * xMultiplier,
    opacity: 0,
    filter: "blur(1px)",
    transition: {
      duration: 0.18,
      ease: cubicBezier(0.165, 0.84, 0.44, 1),
      delay: index * 0.02,
    },
  }),
  hidden: {
    x: 8 * direction * xMultiplier,
    opacity: 0,
    filter: "blur(1px)",
  },
});

type HeaderMenuContentProps<T> = {
  title: string;
  action?: React.ReactNode;
  columns: 2 | 3;
  direction: 1 | -1;
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
};

export default function HeaderMenuContent<T>({
  title,
  action,
  columns,
  direction,
  items,
  itemKey,
  renderItem,
}: HeaderMenuContentProps<T>) {
  const [generationState, setGenerationState] = useState({
    title,
    generation: 0,
  });

  if (generationState.title !== title) {
    setGenerationState({ title, generation: generationState.generation + 1 });
  }

  const { generation } = generationState;

  return (
    <div className="flex-1 p-40 contain-paint">
      <div className="flex items-end justify-between gap-16">
        <div className="min-w-0">
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.div
              animate="visible"
              className="text-heading-h5"
              exit="exit"
              initial="hidden"
              key={generation}
              variants={menuItemVariants(0, direction, 0.5)}
            >
              {title}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {action && (
            <motion.div
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: {
                  duration: 0.18,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                },
              }}
              initial={{ opacity: 0 }}
              key="action"
              transition={{
                duration: 0.2,
                delay: 0.1,
                ease: cubicBezier(0.165, 0.84, 0.44, 1),
              }}
            >
              {action}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-2 my-31.5 h-px bg-border-default" />

      <div
        className={cn([
          "grid gap-x-8 gap-y-24",
          columns === 3 ? "grid-cols-3" : "grid-cols-2",
        ])}
      >
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              animate="visible"
              exit="exit"
              initial="hidden"
              key={`${generation}-${itemKey(item)}`}
              variants={menuItemVariants(2 + index, direction)}
            >
              {renderItem(item)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
