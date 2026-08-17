import cn from "classnames";
import { motion, type MotionProps } from "motion/react";
import type { ReactNode } from "react";
import { useMeasuredSize } from "./use-measured-size";

type Axis = "height" | "width" | "both";

export default function AnimatedDimension({
  axis,
  children,
  innerClassName,
  transition,
}: {
  axis: Axis;
  children: ReactNode;
  innerClassName?: string;
  transition?: MotionProps["transition"];
}) {
  const { containerRef, size } = useMeasuredSize(axis === "height");
  const dimensions = {
    ...(axis !== "width" && size.height !== "auto" && { height: size.height }),
    ...(axis !== "height" && size.width !== "auto" && { width: size.width }),
  };

  return (
    <motion.div
      animate={dimensions}
      className={cn(
        axis === "width" && "relative overflow-clip",
        axis === "both" && "overflow-clip"
      )}
      initial={dimensions}
      ref={containerRef}
      transition={transition}
    >
      <div
        className={cn(
          axis !== "width" && "h-max",
          axis !== "height" && "w-max",
          axis === "width" && "whitespace-nowrap",
          innerClassName
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
