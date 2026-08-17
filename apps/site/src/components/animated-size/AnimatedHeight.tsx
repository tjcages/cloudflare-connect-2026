import type { MotionProps } from "motion/react";
import type { ReactNode } from "react";
import AnimatedDimension from "./AnimatedDimension";

interface AnimatedHeight {
  children: ReactNode;
  transition?: MotionProps["transition"];
}

export default function AnimatedHeight({
  children,
  transition,
}: AnimatedHeight) {
  return (
    <AnimatedDimension axis="height" transition={transition}>
      {children}
    </AnimatedDimension>
  );
}
