import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { useIllustrationIndex } from "@/components/_animations/shared/illustration-event";
import { FRAMEWORKS } from "./frameworks";

export default function FrameworkLogo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const index = useIllustrationIndex(rootRef, "deploy-framework");

  const { name, Logo, size } = FRAMEWORKS[index];

  return (
    <div className="relative size-full" ref={rootRef}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          className="absolute inset-0 flex-center"
          exit={{ y: -60, opacity: 0, filter: "blur(3px)" }}
          initial={{ y: 60, opacity: 0, filter: "blur(3px)" }}
          key={name}
          transition={{ duration: 0.45, ease: [0.6, 0.6, 0, 1] }}
        >
          <Logo height={size} width={size} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
