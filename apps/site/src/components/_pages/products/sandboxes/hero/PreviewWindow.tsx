import { AnimatePresence, motion } from "motion/react";

import HeroWindow from "@/components/HeroWindow";
import PreviewStatus from "@/components/PreviewStatus";
import Icon from "@/components/icon/Icon";

import type { Act, Stage } from "./acts";
import LoadingPreview from "./LoadingPreview";

export default function PreviewWindow({
  act,
  stage,
  stageIndex,
  live,
}: {
  act: Act;
  stage: Stage;
  stageIndex: number;
  live: boolean;
}) {
  const Preview = act.preview;

  return (
    <HeroWindow
      variant="preview"
      className="isolate overflow-clip bg-background-base shadow-elevation-default-drops after:pointer-events-none after:absolute after:inset-0 after:z-30 after:shadow-elevation-default-ring"
    >
      <div className="absolute inset-x-0 top-0 h-48">
        <span className="absolute top-16 left-16 flex-center h-16 w-40 gap-6">
          <span className="size-6 rounded-full bg-orange-900" />
          <span className="size-6 rounded-full bg-orange-800" />
          <span className="size-6 rounded-full bg-green-900" />
        </span>

        <span className="absolute top-12 left-1/2 flex h-24 -translate-x-1/2 items-center gap-4 rounded-full bg-background-faint py-4 pr-10 pl-8">
          <Icon
            name="cloudflare"
            variant="duo"
            color="orange"
            className="h-12 w-18 shrink-0"
          />

          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={act.host}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
              className="block w-176 text-body-tiny whitespace-nowrap text-text-default"
            >
              ...{act.host}.
              <span className="text-label-tiny text-text-base">
                trycloudflare.app
              </span>
            </motion.span>
          </AnimatePresence>
        </span>

        <PreviewStatus
          done={live}
          doneLabel="Live"
          className="absolute top-16 right-16 gap-2"
        />
      </div>

      <div className="absolute top-48 left-6 h-196 w-348 overflow-clip before:inner-border before:z-20 before:border-border-default before:[transition:none]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={live ? act.id : "loading"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.165, 0.84, 0.44, 1] }}
            className="absolute inset-0"
          >
            {live ? (
              <Preview />
            ) : (
              <LoadingPreview stage={stage} stageIndex={stageIndex} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </HeroWindow>
  );
}
