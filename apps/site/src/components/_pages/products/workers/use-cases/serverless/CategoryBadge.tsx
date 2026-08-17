import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import AnimatedWidth from "@/components/animated-size/AnimatedWidth";
import Badge from "@/components/_animations/ui/Badge";
import { useIllustrationIndex } from "@/components/_animations/shared/illustration-event";
import { CATEGORIES } from "./categories";

export default function CategoryBadge() {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = useIllustrationIndex(rootRef, "serverless-category");

  const label = CATEGORIES[index].label;

  return (
    <Badge className="flex text-text-default" padded={false} ref={rootRef}>
      <AnimatedWidth transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            className="flex px-10 py-4 whitespace-pre"
            exit={{ opacity: 0, filter: "blur(1px)", scale: 1.05 }}
            initial={{ opacity: 0, filter: "blur(1px)", scale: 0.95 }}
            key={label}
            transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
          >
            {label}
          </motion.div>
        </AnimatePresence>
      </AnimatedWidth>
    </Badge>
  );
}
