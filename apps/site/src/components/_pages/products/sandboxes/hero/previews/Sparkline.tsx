import { motion } from "motion/react";

import type { SparkPaths } from "./sparklines";

export default function Sparkline({
  paths,
  delay,
  className,
}: {
  paths: SparkPaths;
  delay: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox={paths.viewBox}
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id={paths.id}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <motion.path
        d={paths.area}
        fill={`url(#${paths.id})`}
        fillOpacity={0.16}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.6,
          delay: delay + 0.35,
          ease: [0.6, 0.6, 0, 1],
        }}
      />

      <motion.path
        d={paths.line}
        stroke="currentColor"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay, ease: [0.6, 0.6, 0, 1] }}
      />
    </svg>
  );
}
