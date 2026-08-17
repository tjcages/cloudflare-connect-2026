import { animate } from "motion";
import type { RefObject } from "react";

export function FadeInBadge(
  ref: RefObject<HTMLDivElement | null>,
  y: number,
  x: number
) {
  animate(
    ref.current,
    {
      y: [0, y],
      x: [0, x],
    },
    {
      duration: 2.5,
      ease: [0.6, 0.6, 0, 1],
    }
  );
  animate(
    ref.current,
    {
      opacity: [0, 1, 1, 0],
    },
    {
      duration: 1,
      times: [0, 0.1, 0.9, 1],
      ease: [0.6, 0.6, 0, 1],
    }
  );
  animate(
    ref.current,
    {
      scale: [0, 1],
    },
    {
      duration: 0.2,
      ease: "linear",
    }
  );
}
