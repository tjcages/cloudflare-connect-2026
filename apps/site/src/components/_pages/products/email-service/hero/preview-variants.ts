import type { Variants } from "motion/react";

import { PREVIEW_DELAY } from "./emails";

export const part = (index: number): Variants => ({
  hidden: { opacity: 0, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.28,
      ease: [0.6, 0.6, 0, 1],
      delay: PREVIEW_DELAY + index * 0.07,
    },
  },
  exit: {
    opacity: 0,
    filter: "blur(2px)",
    transition: {
      duration: 0.2,
      ease: [0.6, 0.6, 0, 1],
      delay: PREVIEW_DELAY + index * 0.04,
    },
  },
});

export const swap: Variants = {
  hidden: { y: -12, opacity: 0, filter: "blur(1px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.25, ease: [0.165, 0.84, 0.44, 1], delay: 0.03 },
  },
  exit: {
    y: 12,
    opacity: 0,
    filter: "blur(1px)",
    transition: { duration: 0.25, ease: [0.165, 0.84, 0.44, 1] },
  },
};
