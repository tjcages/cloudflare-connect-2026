import cn from "classnames";
import { AnimatePresence, motion } from "motion/react";
import type { Ref } from "react";

/**
 * Swaps a line of copy word by word rather than as one block, so the outgoing
 * and incoming strings never read as two labels stacked on each other.
 */
export default function WordFade({
  text,
  delay = 0,
  duration = 0.25,
  stagger = 0.05,
  y = 0,
  initial = false,
  className,
  ref,
}: {
  text: string;
  delay?: number;
  duration?: number;
  /** Gap between each word landing. Shorter labels want less. */
  stagger?: number;
  /** Distance each word rises through as it lands. 0 fades in place. */
  y?: number;
  /**
   * Whether the words animate on this component's own first render. Leave
   * false when the instance is mounted for its island's whole life — it then
   * suppresses the hydration frame only. Set true when a parent unmounts and
   * remounts it, or every remount counts as a first render and the words
   * appear at their settled values with no entrance at all.
   */
  initial?: boolean;
  className?: string;
  ref?: Ref<HTMLSpanElement>;
}) {
  return (
    <span className={cn("flex", className)} ref={ref}>
      <AnimatePresence initial={initial} mode="popLayout">
        <motion.span className="flex whitespace-pre" key={text}>
          {text.split(" ").map((word, index, words) => (
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="whitespace-pre"
              exit={{ opacity: 0, filter: "blur(1px)", y: -y }}
              initial={{ opacity: 0, filter: "blur(1px)", y }}
              key={index}
              transition={{
                duration,
                ease: [0.6, 0.6, 0, 1],
                delay: delay + index * stagger,
              }}
            >
              {index < words.length - 1 ? `${word} ` : word}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
