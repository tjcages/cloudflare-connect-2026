import cn from "classnames";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import type { IslandProps } from "@/types/island-props";
import type { LottieSvg, LottieSvgLayer, LottieSvgShape } from "./types";

const TRANSFORM_KEYS = ["opacity", "rotate", "x", "y"] as const;

function Shape({
  duration,
  shape,
}: {
  duration: number;
  shape: LottieSvgShape;
}) {
  const paint = {
    fill: shape.fill ?? "none",
    fillOpacity: shape.fillOpacity,
    fillRule: shape.fillRule,
    opacity: shape.opacity,
    stroke: shape.stroke ?? "none",
    strokeLinecap: shape.strokeLinecap,
    strokeLinejoin: shape.strokeLinejoin,
    strokeMiterlimit: shape.strokeMiterlimit,
    strokeOpacity: shape.strokeOpacity,
    strokeWidth: shape.strokeWidth,
    transform: shape.transform,
  };

  if (typeof shape.d === "string") {
    return <path d={shape.d} {...paint} />;
  }

  return (
    <motion.path
      animate={{ d: shape.d.values }}
      initial={{ d: shape.d.values[0] }}
      transition={{ duration, ease: shape.d.ease, times: shape.d.times }}
      {...paint}
    />
  );
}

function Layer({
  duration,
  layer,
}: {
  duration: number;
  layer: LottieSvgLayer;
}) {
  const animate: Record<string, number | number[]> = {};
  const initial: Record<string, number> = {};
  const transition: Record<string, object> = {};

  for (const key of TRANSFORM_KEYS) {
    const value = layer[key];
    if (typeof value === "number") {
      animate[key] = value;
      initial[key] = value;
    } else {
      animate[key] = value.values;
      initial[key] = value.values[0];
      transition[key] = { duration, ease: value.ease, times: value.times };
    }
  }

  return (
    <motion.g
      animate={animate}
      initial={initial}
      style={{ originX: 0, originY: 0, transformBox: "view-box" }}
      transition={transition}
    >
      {layer.shapes.map((shape, index) => (
        <Shape duration={duration} key={index} shape={shape} />
      ))}
    </motion.g>
  );
}

export type IconAnimationProps = IslandProps<{
  animation: LottieSvg;
  className?: string;
}>;

export default function IconAnimation({
  animation,
  className,
}: IconAnimationProps) {
  return (
    <svg
      aria-hidden
      className={cn("block shrink-0", className)}
      fill="none"
      style={
        {
          "--icon-color-primary": `var(--color-${animation.family}-900)`,
          "--icon-color-secondary": `var(--color-${animation.family}-800)`,
        } as CSSProperties
      }
      viewBox={`0 0 ${animation.width} ${animation.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {animation.layers.map((layer, index) => (
        <Layer duration={animation.duration} key={index} layer={layer} />
      ))}
    </svg>
  );
}
