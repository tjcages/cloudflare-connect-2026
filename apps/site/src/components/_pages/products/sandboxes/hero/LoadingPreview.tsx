import { AnimatePresence, motion } from "motion/react";

import Icon from "@/components/icon/Icon";
import TextWave from "@/components/text-wave/TextWave";

import { PROGRESS, type Stage } from "./acts";

export default function LoadingPreview({
  stage,
  stageIndex,
}: {
  stage: Stage;
  stageIndex: number;
}) {
  const progress = PROGRESS[Math.min(stageIndex, PROGRESS.length - 1)];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-12 bg-background-surface px-24">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.6, 0.6, 0, 1] }}
        className="flex-center size-44 rounded-12 bg-background-base shadow-elevation-default"
      >
        <span className="size-16 rounded-t-full bg-icon-faint" />
      </motion.span>

      <span className="flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.07, ease: [0.6, 0.6, 0, 1] }}
          className="text-label-tiny text-text-base"
        >
          Loading preview
        </motion.span>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: [0.6, 0.6, 0, 1] }}
          className="flex h-16 items-center"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={stage.doing}
              initial={{ y: 6, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                transition: { duration: 0.24, ease: [0.165, 0.84, 0.44, 1] },
              }}
              exit={{
                y: -6,
                opacity: 0,
                transition: { duration: 0.18, ease: [0.165, 0.84, 0.44, 1] },
              }}
              className="block text-body-tiny whitespace-nowrap text-text-muted"
            >
              <TextWave text={stage.doing} />
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </span>

      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.21, ease: [0.6, 0.6, 0, 1] }}
        className="block h-4 w-192 overflow-clip rounded-full bg-background-faint"
      >
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.5, ease: [0.6, 0.6, 0, 1] }}
          className="block h-full w-full origin-left rounded-full bg-background-accent-orange"
        />
      </motion.span>

      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28, ease: [0.6, 0.6, 0, 1] }}
        className="flex h-16 items-center"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {stage.done ? (
            <motion.span key={stage.done} className="flex items-center gap-6">
              <motion.span
                initial={{ y: 6, opacity: 0 }}
                animate={{
                  y: 0,
                  opacity: 1,
                  transition: {
                    duration: 0.24,
                    delay: 0.09,
                    ease: [0.165, 0.84, 0.44, 1],
                  },
                }}
                exit={{
                  y: -6,
                  opacity: 0,
                  transition: {
                    duration: 0.18,
                    delay: 0.06,
                    ease: [0.165, 0.84, 0.44, 1],
                  },
                }}
                className="flex-center shrink-0"
              >
                <Icon
                  name="checkmark-1-medium"
                  size={16}
                  className="text-icon-accent-success"
                />
              </motion.span>

              <motion.span
                initial={{ y: 6, opacity: 0 }}
                animate={{
                  y: 0,
                  opacity: 1,
                  transition: {
                    duration: 0.24,
                    delay: 0.16,
                    ease: [0.165, 0.84, 0.44, 1],
                  },
                }}
                exit={{
                  y: -6,
                  opacity: 0,
                  transition: {
                    duration: 0.18,
                    delay: 0.12,
                    ease: [0.165, 0.84, 0.44, 1],
                  },
                }}
                className="block text-body-tiny whitespace-nowrap text-text-default"
              >
                {stage.done}
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
    </div>
  );
}
