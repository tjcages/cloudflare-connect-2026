import cn from "classnames";
import { AnimatePresence, motion } from "motion/react";

import ScatterText from "@/components/scatter-text/ScatterText";

export default function PreviewStatus({
  done,
  doneLabel,
  pendingLabel,
  className,
}: {
  done: boolean;
  doneLabel: string;
  pendingLabel?: string;
  className?: string | string[];
}) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {done || pendingLabel ? (
        <motion.span
          key="badge"
          initial={{ opacity: 0, y: 6 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.24,
              delay: 0.3,
              ease: [0.165, 0.84, 0.44, 1],
            },
          }}
          exit={{
            opacity: 0,
            y: -6,
            transition: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] },
          }}
          className={cn(["flex items-center", className])}
        >
          <span className="relative flex-center size-16">
            <AnimatePresence initial={false} mode="popLayout">
              {done ? null : (
                <motion.span
                  key="ring"
                  initial={{ scale: 0.4, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: [0.6, 0.6, 0] }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.2, ease: [0.6, 0.6, 0, 1] },
                  }}
                  transition={{
                    duration: 1.8,
                    ease: [0.165, 0.84, 0.44, 1],
                    repeat: Infinity,
                    repeatDelay: 0.4,
                    opacity: {
                      duration: 1.8,
                      times: [0, 0.35, 1],
                      ease: [0.165, 0.84, 0.44, 1],
                      repeat: Infinity,
                      repeatDelay: 0.4,
                    },
                  }}
                  className="absolute inset-0 m-auto size-15 rounded-full shadow-[0_0_0_1px_var(--color-icon-accent-orange)]"
                />
              )}
            </AnimatePresence>

            <span
              className={cn([
                "relative z-10 size-6 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.6,0.6,0,1)]",
                done ? "bg-icon-accent-success" : "bg-icon-accent-orange",
              ])}
            />
          </span>

          <ScatterText
            text={done ? doneLabel : (pendingLabel ?? doneLabel)}
            className="block text-label-tiny whitespace-nowrap"
            letterClassName={
              done ? "text-text-accent-success" : "text-text-accent-orange"
            }
          />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
