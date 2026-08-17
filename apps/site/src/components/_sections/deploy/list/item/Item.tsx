import cn from "classnames";
import { AnimatePresence, motion } from "motion/react";
import DotsGrid from "../_svg/DotsGrid.svg?react";
import StatusIcon from "./status-icon/StatusIcon";
import type { Status, Version } from "../types";
import { formatDuration, formatVersion } from "../utils";

export default function DeployListItem({
  version,
  index,
  status,
  duration,
  environment,
  title,
  commitName,
  active,
}: {
  version: Version;
  index: number;
  status: Status;
  duration: number;
  environment: string;
  title: string;
  commitName: string;
  active: boolean;
}) {
  const colors = {
    Building: "var(--color-orange-900)",
    Queued: "var(--color-text-muted)",
    Deployed: "var(--color-green-900)",
  };
  const mutedTextColor = {
    Building: "var(--color-orange-900)",
    Queued: "var(--color-text-muted)",
    Deployed: "var(--color-text-base)",
  };
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -72,
      }}
      animate={{
        opacity: 1,
        y: index * 72,
      }}
      exit={{
        opacity: 0,
        y: 72 * index + 72,
      }}
      transition={{
        duration: 0.45,
        ease: [0.6, 0.6, 0, 1],
      }}
      className="absolute top-0 left-0 flex w-full max-w-560 items-center gap-52 px-20 py-16 text-body-x-small text-text-base before:inside-border-b before:border-border-default"
    >
      <div
        style={{ color: colors[status] }}
        className="flex w-88 items-start gap-8 transition-colors duration-200"
      >
        <StatusIcon status={status} />

        <div className="flex flex-col items-start">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={status}
              initial={{
                y: 16,
                opacity: 0,
                filter: "blur(2px)",
                color: colors[status],
              }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{
                y: -16,
                opacity: 0,
                filter: "blur(2px)",
                color: colors[status],
              }}
              transition={{
                duration: 0.35,
                ease: [0.6, 0.6, 0, 1],
                delay: 0.05,
              }}
            >
              {status}
            </motion.div>
          </AnimatePresence>

          <span className="text-left text-text-muted">
            {status === "Queued" ? "Waiting" : formatDuration(duration)}
          </span>
        </div>
      </div>

      <div
        style={{ color: mutedTextColor[status] }}
        className="flex w-88 flex-col transition-colors duration-200"
      >
        {formatVersion(version)}
        <span className="text-text-muted"> {environment}</span>
      </div>

      <div
        style={{ color: mutedTextColor[status] }}
        className="flex-1 transition-colors duration-200"
      >
        {title}
        <div className="whitespace-nowrap text-text-muted"> {commitName}</div>
      </div>

      <div
        className={cn(
          "relative w-32 rounded-full p-6 transition-colors duration-200",
          active ? "bg-background-ghost text-icon-base" : "text-icon-muted",
          status === "Deployed" && !active
            ? "cursor-pointer"
            : "pointer-events-none"
        )}
      >
        <div className="relative">
          <DotsGrid />
        </div>
      </div>
    </motion.div>
  );
}
