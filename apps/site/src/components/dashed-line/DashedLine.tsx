import cn from "classnames";
import type { CSSProperties } from "react";
import "./DashedMarch.css";

type AnimateTowards = "right" | "left" | "top" | "bottom";

const dashMotionByDirection: Record<
  AnimateTowards,
  { className: string; x: string; y: string }
> = {
  left: { className: "left-0", x: "-8px", y: "0" },
  right: { className: "-left-8", x: "8px", y: "0" },
  top: { className: "top-0", x: "0", y: "-8px" },
  bottom: { className: "-top-8", x: "0", y: "8px" },
};

export default function DashedLine({
  style,
  direction,
  animateTowards,
  className,
}: {
  style?: CSSProperties;
  direction: "horizontal" | "vertical";
  animateTowards?: AnimateTowards;
  className?: string;
}) {
  const isVertical = direction === "vertical";
  const motion = animateTowards
    ? dashMotionByDirection[animateTowards]
    : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none block overflow-hidden",
        isVertical ? "w-px" : "h-px",
        className
      )}
      style={style}
    >
      <svg
        className={cn(
          "relative block",
          isVertical
            ? motion
              ? "h-[calc(100%+8px)] w-px"
              : "h-full w-px"
            : motion
              ? "h-px w-[calc(100%+8px)]"
              : "h-px w-full",
          motion?.className,
          motion && "dashed-line-animate"
        )}
        shapeRendering="crispEdges"
        style={
          motion
            ? ({
                "--dashed-line-x": motion.x,
                "--dashed-line-y": motion.y,
              } as CSSProperties)
            : undefined
        }
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          stroke="currentColor"
          strokeDasharray="3 5"
          strokeWidth="1"
          x1={isVertical ? 0.5 : 0}
          x2={isVertical ? 0.5 : "100%"}
          y1={isVertical ? 0 : 0.5}
          y2={isVertical ? "100%" : 0.5}
        />
      </svg>
    </span>
  );
}
