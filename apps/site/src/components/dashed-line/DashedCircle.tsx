import cn from "classnames";
import type { CSSProperties } from "react";
import "./DashedMarch.css";

type AnimateTowards = "clockwise" | "counter-clockwise";

const dashTravelByDirection: Record<AnimateTowards, string> = {
  clockwise: "-8px",
  "counter-clockwise": "8px",
};

export default function DashedCircle({
  style,
  animateTowards,
  className,
}: {
  style?: CSSProperties;
  animateTowards?: AnimateTowards;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      style={style}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className={animateTowards ? "dashed-circle-animate" : undefined}
        cx="50"
        cy="50"
        fill="none"
        r="49"
        stroke="currentColor"
        strokeDasharray="3 5"
        strokeWidth="1"
        style={
          animateTowards
            ? ({
                "--dashed-circle-travel": dashTravelByDirection[animateTowards],
              } as CSSProperties)
            : undefined
        }
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
