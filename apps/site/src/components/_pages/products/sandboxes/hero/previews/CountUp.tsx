import cn from "classnames";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

export default function CountUp({
  to,
  format,
  delay,
  className,
}: {
  to: number;
  format: (value: number) => string;
  delay: number;
  className?: string;
}) {
  const count = useMotionValue(0);
  const text = useTransform(count, format);

  useEffect(() => {
    const controls = animate(count, to, {
      duration: 0.9,
      delay,
      ease: [0.165, 0.84, 0.44, 1],
    });

    return () => {
      controls.stop();
    };
  }, [count, to, delay]);

  return (
    <motion.span className={cn(["tabular-nums", className])}>
      {text}
    </motion.span>
  );
}
