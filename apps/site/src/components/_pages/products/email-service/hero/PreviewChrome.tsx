import { AnimatePresence, motion } from "motion/react";

import PreviewStatus from "@/components/PreviewStatus";

import { swap } from "./preview-variants";

export default function PreviewChrome({
  sent,
  title,
}: {
  sent: boolean;
  title: string;
}) {
  return (
    <div className="relative flex h-48 items-center px-16">
      <div className="flex w-40 items-center gap-6">
        <span className="size-6 rounded-full bg-orange-900" />
        <span className="size-6 rounded-full bg-orange-800" />
        <span className="size-6 rounded-full bg-green-900" />
      </div>

      <div className="absolute left-1/2 flex h-24 w-160 -translate-x-1/2 items-center justify-center overflow-clip rounded-full bg-background-faint">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={title}
            variants={swap}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="block max-w-140 truncate text-label-tiny text-text-base"
          >
            {title}
          </motion.span>
        </AnimatePresence>
      </div>

      <PreviewStatus
        done={sent}
        pendingLabel="Sending"
        doneLabel="Sent"
        className="ml-auto gap-4"
      />
    </div>
  );
}
