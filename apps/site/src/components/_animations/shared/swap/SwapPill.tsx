import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { useIllustrationEvent } from "@/components/_animations/shared/illustration-event";
import IconSwap from "@/components/_animations/shared/swap/IconSwap";
import WordFade from "@/components/_animations/shared/swap/WordFade";

export type SwapFace = { swapKey: string; label: string; icon: ReactNode };

/**
 * The pill face shared by every hub-and-reel card: a row that fades out as a
 * whole, and inside it an icon and a label that swap independently.
 *
 * The three class props carry no defaults on purpose. A status pill sits in a
 * slot that already brings its own padding, so a shared `p-10` would crush it.
 */
export default function SwapPill<T>({
  channel,
  initial,
  face,
  className,
  rowClassName,
  labelClassName,
}: {
  channel: string;
  initial: T;
  /** Return null for the states that render nothing — every card's idle. */
  face: (detail: T) => SwapFace | null;
  className: string;
  rowClassName: string;
  labelClassName: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<T>(initial);

  useIllustrationEvent<T>(rootRef, channel, setDetail);

  const shown = face(detail);

  return (
    <div className={className} ref={rootRef}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown ? (
          <motion.div
            className={rowClassName}
            exit={{ opacity: 0, filter: "blur(1px)" }}
            key="content"
            transition={{ duration: 0.3, ease: [0.6, 0.6, 0, 1] }}
          >
            <IconSwap
              className="size-20 shrink-0"
              initial
              swapKey={shown.swapKey}
            >
              {shown.icon}
            </IconSwap>

            <div className={labelClassName}>
              <WordFade
                className="text-label-x-small whitespace-nowrap text-text-base"
                delay={0.04}
                initial
                stagger={0.025}
                text={shown.label}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
