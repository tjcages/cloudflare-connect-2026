import cn from "classnames";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Fragment } from "react";

import Icon from "@/components/icon/Icon";

import "./RunStatus.css";

interface Props {
  doneLabel: string;
  running: boolean;
  tone: "info" | "orange";
}

const RUNNING_LABEL = "Running...";

// Explicit per-child delays, not staggerChildren on a wrapper: a wrapper
// variant carrying only a transition has nothing to animate, so AnimatePresence
// stops waiting for it and the swap snaps.
const part = (index: number): Variants => ({
  hidden: { y: -8, opacity: 0, filter: "blur(1px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.22,
      ease: [0.165, 0.84, 0.44, 1],
      delay: 0.015 + index * 0.08,
    },
  },
  exit: {
    y: 8,
    opacity: 0,
    filter: "blur(1px)",
    transition: {
      duration: 0.18,
      ease: [0.165, 0.84, 0.44, 1],
      delay: index * 0.05,
    },
  },
});

export default function RunStatus({ doneLabel, running, tone }: Props) {
  const accent =
    tone === "orange" ? "text-icon-accent-orange" : "text-icon-accent-info";

  return (
    <div className="relative flex h-20 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={running ? "running" : "done"}
          className="flex items-center gap-8"
        >
          <motion.span
            variants={part(0)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative flex size-20"
          >
            {running ? (
              <Fragment>
                <svg
                  aria-hidden
                  className="absolute inset-0 text-border-default"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                </svg>
                <span className="flex animate-spin">
                  <Icon name="spinner-arc" size={20} className={accent} />
                </span>
              </Fragment>
            ) : (
              <Icon
                name="checkmark-1-medium"
                size={20}
                className="text-icon-accent-success"
              />
            )}
          </motion.span>

          <motion.span
            variants={part(1)}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn([
              "text-body-x-small",
              !running
                ? "text-text-accent-success"
                : tone === "orange"
                  ? "text-text-accent-orange"
                  : "text-text-accent-info",
            ])}
          >
            {running
              ? RUNNING_LABEL.split("").map((char, index) => (
                  <span
                    key={index}
                    className="run-status-wave"
                    data-tone={tone}
                    style={{ animationDelay: `${index * 0.07}s` }}
                  >
                    {char}
                  </span>
                ))
              : doneLabel}
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
