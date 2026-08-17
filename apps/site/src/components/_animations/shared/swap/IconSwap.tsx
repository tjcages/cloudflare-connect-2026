import cn from "classnames";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode, Ref } from "react";

type Timing = { delay: number; duration: number };

/**
 * Crossfades whatever sits in an icon-sized slot: opacity + blur + scale, in on
 * 0.95 and out to 1.05. `custom` is passed to the child as well as to the
 * AnimatePresence, because an entering child never reads the presence's copy.
 */
export default function IconSwap({
  swapKey,
  delay = 0,
  duration = 0.18,
  scale = 0.05,
  y = 0,
  initial = false,
  className,
  ref,
  children,
}: {
  swapKey: string;
  delay?: number;
  duration?: number;
  /** How far the swap scales through. 0 swaps at rest size. */
  scale?: number;
  /**
   * Distance the icon rises through as it lands, matching WordFade's prop of
   * the same name so a glyph and its label can travel together. 0 swaps in
   * place.
   */
  y?: number;
  /**
   * Whether the icon animates on this component's own first render. Same rule
   * as WordFade: leave false while the instance outlives its content, set true
   * when a parent remounts it, or the entrance never plays.
   */
  initial?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const timing: Timing = { delay, duration };

  return (
    <div className={cn("relative", className)} ref={ref}>
      <AnimatePresence custom={timing} initial={initial} mode="popLayout">
        <motion.div
          animate="animate"
          className="absolute inset-0 flex-center"
          custom={timing}
          exit="exit"
          initial="initial"
          key={swapKey}
          variants={{
            initial: { opacity: 0, filter: "blur(1px)", scale: 1 - scale, y },
            animate: (t: Timing) => ({
              opacity: 1,
              filter: "blur(0px)",
              scale: 1,
              y: 0,
              transition: {
                duration: t.duration,
                ease: [0.6, 0.6, 0, 1],
                delay: t.delay,
              },
            }),
            exit: (t: Timing) => ({
              opacity: 0,
              filter: "blur(1px)",
              scale: 1 + scale,
              y: -y,
              transition: {
                duration: t.duration,
                ease: [0.6, 0.6, 0, 1],
                delay: t.delay,
              },
            }),
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
