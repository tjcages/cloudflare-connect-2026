import { AnimatePresence, motion } from "motion/react";

import type { EmailKind, Ghosts } from "./emails";
import { PREVIEW_DELAY } from "./emails";
import { part } from "./preview-variants";

export default function PreviewCard({
  ghosts,
  preview,
  shown,
  validated,
}: {
  ghosts: Ghosts;
  preview: EmailKind["preview"];
  shown: boolean;
  validated: boolean;
}) {
  return (
    <div className="relative mx-auto flex h-216 w-172 flex-col gap-16 rounded-8 bg-background-base p-20">
      <div className="h-16 w-16 shrink-0 rounded-t-full bg-icon-faint" />

      <div className="relative flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          {shown ? (
            <motion.div key="content" className="absolute inset-0">
              <motion.div
                animate={{ opacity: validated ? 1 : 0.4 }}
                initial={false}
                // Brightens only once the step that validated it has finished
                // leaving the row above.
                transition={{
                  duration: 0.3,
                  ease: [0.6, 0.6, 0, 1],
                  delay: validated ? PREVIEW_DELAY : 0,
                }}
                className="flex h-full flex-col gap-16"
              >
                <div className="flex flex-col gap-8">
                  <motion.p
                    variants={part(0)}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="text-label-chip text-text-base"
                  >
                    {preview.heading}
                  </motion.p>
                  <motion.p
                    variants={part(1)}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    // Three lines high whatever the copy runs to, so the button
                    // below never moves between emails or between the ghost and
                    // the real thing.
                    className="line-clamp-3 h-48 text-body-chip text-text-default"
                    dangerouslySetInnerHTML={{ __html: preview.body }}
                  />
                </div>

                <motion.div
                  variants={part(2)}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex-center h-24 w-92 shrink-0 truncate rounded-full bg-icon-faint text-label-chip text-text-inverse"
                >
                  {preview.cta}
                </motion.div>

                <motion.p
                  variants={part(3)}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="truncate text-body-chip text-text-default"
                >
                  {preview.note}
                </motion.p>
              </motion.div>
            </motion.div>
          ) : (
            // Every ghost sits in a box the height of the line it stands in
            // for, so nothing shifts when the real copy arrives.
            <motion.div
              key="ghost"
              className="absolute inset-0 flex flex-col gap-16"
            >
              <div className="flex flex-col gap-8">
                <motion.div
                  variants={part(0)}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex h-16 items-center"
                >
                  <span className="ghost-bar relative block h-6 w-88 overflow-clip rounded-4 bg-darker/6" />
                </motion.div>
                <div className="flex h-48 flex-col">
                  {ghosts.body.map((width, index) => (
                    <motion.div
                      key={index}
                      variants={part(index + 1)}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="flex h-16 items-center"
                    >
                      <span
                        className="ghost-bar relative block h-6 overflow-clip rounded-4 bg-darker/4"
                        style={{ width }}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
              <motion.div
                variants={part(4)}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="ghost-bar relative h-24 w-92 shrink-0 overflow-clip rounded-full bg-darker/5"
              />
              <motion.div
                variants={part(5)}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex h-16 items-center"
              >
                <span className="ghost-bar relative block h-6 w-104 overflow-clip rounded-4 bg-darker/4" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
