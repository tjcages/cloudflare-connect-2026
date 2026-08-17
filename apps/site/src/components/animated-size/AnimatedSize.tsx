import type { MotionProps } from "motion/react";
import type { ReactNode } from "react";
import AnimatedDimension from "./AnimatedDimension";

interface AnimatedSizeProps {
  children: ReactNode;
  innerClassName?: string;
  transition?: MotionProps["transition"];
}

export default function AnimatedSize({
  children,
  innerClassName,
  transition,
}: AnimatedSizeProps) {
  return (
    <AnimatedDimension
      axis="both"
      innerClassName={innerClassName}
      transition={transition}
    >
      {children}
    </AnimatedDimension>
  );
}
