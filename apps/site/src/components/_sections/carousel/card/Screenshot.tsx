import cn from "classnames";
import { animate, motion } from "motion/react";
import { useCallback, useRef } from "react";
import CarouselCardRequests, {
  type CardAnimationContext,
} from "./requests/Requests";

export default function Screenshot() {
  const screenshotRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const screenshotAnimation = useCallback(
    async ({ sleep }: CardAnimationContext) => {
      await sleep(700);

      await animate(
        screenshotRef.current,
        {
          height: 156,
          width: 228,
        },
        {
          duration: 0.1,
          ease: [0.6, 0.6, 0, 1],
        }
      );

      animate(
        flashRef.current,
        {
          opacity: [0, 0.75, 0],
        },
        {
          duration: 0.4,

          ease: [0.6, 0.6, 0, 1],
        }
      );
      animate(
        screenshotRef.current,
        {
          height: 160,
          width: 232,
        },
        {
          duration: 0.25,

          ease: [0.6, 0.6, 0, 1],
        }
      );
    },
    []
  );

  return (
    <CarouselCardRequests
      startAnimation={screenshotAnimation}
      variant="site-1"
      returnDelay={250}
      flash={
        <motion.div
          ref={flashRef}
          className="pointer-events-none absolute inset-0 z-50 bg-background-base opacity-0"
        />
      }
      lastChildren={
        <motion.div
          ref={screenshotRef}
          className="absolute top-1/2 left-1/2 mx-auto h-160 w-232 -translate-x-1/2 -translate-y-1/2 bg-background-ghost"
        >
          {corners.map((item, i) => (
            <div
              key={i}
              className={cn([
                "absolute size-12 before:border-border-dashed",
                item,
              ])}
            ></div>
          ))}
        </motion.div>
      }
      title="screenshot"
    >
      {null}
    </CarouselCardRequests>
  );
}
const corners = [
  "top-0 left-0 before:inside-border-t before:inside-border-l",
  "top-0 right-0 before:inside-border-t before:inside-border-r",
  "bottom-0 left-0 before:inside-border-b before:inside-border-l",
  "bottom-0 right-0 before:inside-border-b before:inside-border-r",
];
