import { useCallback, useRef, useState, type RefObject } from "react";
import { animate } from "motion";
import { AnimatePresence, motion } from "motion/react";
import cn from "classnames";
import { pick } from "@/utils/random";
import DownloadButton from "./DownloadButton";
import { FadeInBadge } from "./utils";
import CarouselCardRequests, {
  type CardAnimationContext,
} from "./requests/Requests";

const CLICK_ORIGIN = { x: 52, y: 34 };

export default function Automation() {
  const cursorRef = useRef<SVGGElement>(null);
  const clickCircleRef = useRef<SVGCircleElement>(null);
  const innerCircleRef = useRef<SVGCircleElement>(null);
  const outerCircleRef = useRef<SVGCircleElement>(null);
  const clickBadgeRef = useRef<HTMLDivElement>(null);
  const scrollBadgeRef = useRef<HTMLDivElement>(null);
  const extractBadgeRef = useRef<HTMLDivElement>(null);
  const [isFinished, setIsFinished] = useState(false);

  const ClickBrowser = useCallback(() => {
    animate(
      clickCircleRef.current,
      {
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 0.8, 1],
      },
      {
        duration: 0.35,
        ease: [0.6, 0.6, 0, 1],
      }
    );
    animate(
      cursorRef.current,
      {
        scale: [1, 0.9, 1],
      },
      {
        duration: 0.35,
        ease: [0.6, 0.6, 0, 1],
      }
    );

    FadeInBadge(clickBadgeRef, -26, -86);

    animate(
      innerCircleRef.current,
      {
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1],
      },
      {
        duration: 0.5,
        delay: 0.1,
        ease: "linear",
      }
    );

    animate(
      outerCircleRef.current,
      {
        opacity: [0, 0.2, 0.2, 0],
        scale: [0.5, 1],
      },
      {
        duration: 0.6,
        delay: 0.2,
        ease: "easeOut",
      }
    );
  }, []);

  const BrowserAnimation = useCallback(
    async ({ sleep, card }: CardAnimationContext) => {
      await sleep(500);

      await animate(
        cursorRef.current,
        { opacity: 1 },
        {
          duration: 0.35,
          ease: [0.6, 0.6, 0, 1],
        }
      );

      const panel = card()?.querySelector<HTMLElement>(
        "[data-browser-archetype][data-active]"
      );

      FadeInBadge(scrollBadgeRef, 24, 86);
      if (panel) {
        await animate(
          panel,
          { y: [0, -18] },
          { duration: 0.6, ease: [0.6, 0.6, 0, 1] }
        );
      }
      await sleep(600);

      const targets = panel
        ? [...panel.querySelectorAll<HTMLElement>("[data-click-target]")]
        : [];
      const target = targets.length > 0 ? pick(targets) : null;

      const host = card();
      let point = CLICK_ORIGIN;
      if (target && host) {
        const base = host.getBoundingClientRect();
        const box = target.getBoundingClientRect();
        point = {
          x: (box.left + box.right) / 2 - base.left,
          y: (box.top + box.bottom) / 2 - base.top,
        };
      }

      animate(
        cursorRef.current,
        {
          x: point.x,
          y: point.y,
        },
        {
          duration: 0.45,
          ease: [0.6, 0.6, 0, 1],
        }
      );
      for (const circle of [clickCircleRef, innerCircleRef, outerCircleRef]) {
        animate(
          circle.current,
          { x: point.x, y: point.y },
          { duration: 0.45, ease: [0.6, 0.6, 0, 1] }
        );
      }

      await sleep(600);
      ClickBrowser();

      await sleep(1250);

      FadeInBadge(extractBadgeRef, -86, 86);

      await sleep(200);

      animate(
        cursorRef.current,
        { opacity: 0 },
        { duration: 0.25, ease: [0.165, 0.84, 0.44, 1] }
      );

      setIsFinished(true);
    },
    [ClickBrowser]
  );

  return (
    <CarouselCardRequests
      setFinish={setIsFinished}
      variant="agent"
      startAnimation={BrowserAnimation}
      title="browser"
      overlay={
        <>
          <svg
            className="pointer-events-none absolute inset-0 z-40 size-full overflow-visible"
            fill="none"
          >
            <motion.circle
              initial={{
                r: 4,
                opacity: 0,
                x: CLICK_ORIGIN.x,
                y: CLICK_ORIGIN.y,
              }}
              ref={clickCircleRef}
              className="fill-orange-900"
            />
            <motion.circle
              ref={innerCircleRef}
              initial={{ opacity: 0, x: CLICK_ORIGIN.x, y: CLICK_ORIGIN.y }}
              r="12"
              className="stroke-orange-400"
            />
            <motion.circle
              ref={outerCircleRef}
              initial={{ opacity: 0, x: CLICK_ORIGIN.x, y: CLICK_ORIGIN.y }}
              opacity="0.2"
              r="24"
              className="stroke-orange-400"
            />
            <motion.g
              initial={{
                opacity: 0,
                x: CLICK_ORIGIN.x,
                y: CLICK_ORIGIN.y,
                scale: 1,
              }}
              ref={cursorRef}
            >
              <path
                d="M13.4734 7.29906C14.7153 6.75575 14.6566 4.97451 13.3816 4.51409L2.50758 0.587279C1.31264 0.155753 0.155753 1.31264 0.587279 2.50758L4.51409 13.3816C4.97451 14.6566 6.75575 14.7153 7.29906 13.4734L8.94297 9.71599C9.09421 9.37021 9.37021 9.09421 9.71599 8.94297L13.4734 7.29906Z"
                fill="#1F1F1F"
              />
              <path
                d="M0.117188 2.67773C-0.458249 1.08432 1.08432 -0.458249 2.67773 0.117188L13.5518 4.04395C15.2513 4.65801 15.3294 7.03231 13.6738 7.75684L9.91602 9.40137C9.68594 9.50223 9.50223 9.68594 9.40137 9.91602L7.75684 13.6738C7.03231 15.3294 4.65801 15.2513 4.04395 13.5518L0.117188 2.67773Z"
                stroke="white"
              />
            </motion.g>
          </svg>
          <BrowserBadge
            ref={clickBadgeRef}
            position="top-16 right-64"
            title="Click"
          />
          <BrowserBadge
            ref={scrollBadgeRef}
            position="top-50 right-0"
            title="Scroll"
          />
          <BrowserBadge
            ref={extractBadgeRef}
            position="top-0 right-20"
            title="Extract"
          />
        </>
      }
    >
      <AnimatePresence mode="popLayout">
        {isFinished && (
          <motion.div
            key="download"
            initial={{ opacity: 0, filter: "blur(1px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(1px)", y: 6 }}
            transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
            className="absolute inset-0 z-30 flex-center bg-background-base"
          >
            <DownloadButton iconName="brackets-2" title="JSON" />
          </motion.div>
        )}
      </AnimatePresence>
    </CarouselCardRequests>
  );
}

function BrowserBadge({
  title,
  position,
  ref,
}: {
  title: string;
  position: string;
  ref: RefObject<HTMLDivElement | null>;
}) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      className={cn([
        position,
        "absolute z-40 w-max rounded-full bg-background-base px-12 py-4 text-body-tiny text-text-default shadow-elevation-default",
      ])}
    >
      {title}
    </motion.div>
  );
}
