import cn from "classnames";
import { motion, type Variants } from "motion/react";
import { useRef } from "react";
import { SnakeIndicator } from "./SnakeIndicator";

export type CategoryListItem = {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

export default function CategoryList({
  items,
  activeIndex,
  onSelect,
  className,
  rowVariants,
}: {
  items: CategoryListItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  rowVariants?: (index: number) => Variants;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn("relative flex flex-col gap-4", className)}
      ref={listRef}
    >
      <SnakeIndicator
        activeIndex={activeIndex}
        containerRef={listRef}
        variants={rowVariants?.(0)}
      />

      {items.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <motion.div key={item.key} variants={rowVariants?.(index)}>
            <motion.button
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex w-full items-center rounded-full p-10 text-label-x-small transition-colors duration-150 contain-paint outline-none focus-visible:shadow-button-tertiary-focus active:bg-background-muted",
                isActive ? "bg-background-ghost" : "hover:bg-background-faint",
                item.disabled && "pointer-events-none opacity-40"
              )}
              disabled={item.disabled}
              onClick={() => onSelect(index)}
              type="button"
              whileHover="rowHover"
            >
              <motion.span
                animate={{ x: isActive ? 16 : 0 }}
                className="block flex-1 px-6 text-left"
                initial={false}
                transition={{
                  type: "spring",
                  visualDuration: 0.28,
                  bounce: 0.3,
                }}
                variants={{ rowHover: { x: isActive ? 16 : 4 } }}
              >
                {item.label}
              </motion.span>

              {typeof item.count === "number" && (
                <span className="px-6 font-mono text-text-subtle">
                  {item.count}
                </span>
              )}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}
