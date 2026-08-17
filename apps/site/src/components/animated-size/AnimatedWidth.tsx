import type { Transition } from "motion/react";
import type { ReactNode } from "react";
import AnimatedDimension from "./AnimatedDimension";

interface AnimatedWidthProps {
  children: ReactNode;
  transition?: Transition;
}

export default function AnimatedWidth({
  children,
  transition,
}: AnimatedWidthProps) {
  return (
    <AnimatedDimension axis="width" transition={transition}>
      {children}
    </AnimatedDimension>
  );
}
