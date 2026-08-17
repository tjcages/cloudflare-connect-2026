import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { useIllustrationIndex } from "@/components/_animations/shared/illustration-event";
import Badge from "@/components/_animations/ui/Badge";
import AnimatedWidth from "@/components/animated-size/AnimatedWidth";
import type { IconName } from "@/components/icon/icons.gen";
import type { IslandProps } from "@/types/island-props";

interface SideItem {
  icon: IconName;
  label?: string;
}

interface SideLabelProps {
  items: [SideItem, ...SideItem[]];
  side: "L" | "R";
}

export default function SideLabel({
  items,
  side,
}: IslandProps<SideLabelProps>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = useIllustrationIndex(rootRef, `side-item:${side}`);

  const label = items[index].label;

  return (
    <div ref={rootRef}>
      <AnimatePresence initial={false} mode="popLayout">
        {label ? (
          <motion.div
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(1px)", scale: 1.05 }}
            initial={{ opacity: 0, filter: "blur(1px)", scale: 0.95 }}
            key="badge"
            transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
          >
            <Badge className="flex text-text-default" padded={false}>
              <AnimatedWidth
                transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
              >
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
