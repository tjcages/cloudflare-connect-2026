import cn from "classnames";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export default function HeroWindow({
  variant,
  className,
  children,
}: {
  variant: "primary" | "preview";
  className?: string | string[];
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: variant === "preview" ? 0.12 : 0,
        ease: [0.6, 0.6, 0, 1],
      }}
      className={cn([
        "absolute",
        variant === "primary"
          ? "top-40 left-40 isolate h-400 w-480 overflow-clip bg-background-base shadow-elevation-default-drops after:pointer-events-none after:absolute after:inset-0 after:z-30 after:shadow-elevation-default-ring"
          : "top-350 left-0 h-250 w-360",
        className,
      ])}
    >
      {children}
    </motion.div>
  );
}
