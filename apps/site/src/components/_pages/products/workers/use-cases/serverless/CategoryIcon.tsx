import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import Icon from "@/components/icon/Icon";
import { useIllustrationIndex } from "@/components/_animations/shared/illustration-event";
import { CATEGORIES } from "./categories";

export default function CategoryIcon() {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = useIllustrationIndex(rootRef, "serverless-category");

  const { icon } = CATEGORIES[index];

  return (
    <div className="relative size-24" ref={rootRef}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          className="absolute inset-0 flex-center"
          exit={{ opacity: 0, filter: "blur(1px)", scale: 1.05 }}
          initial={{ opacity: 0, filter: "blur(1px)", scale: 0.95 }}
          key={icon}
          transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
        >
          <Icon name={icon} variant="duo" color="purple" size={24} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
