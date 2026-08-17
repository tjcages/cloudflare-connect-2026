import { AnimatePresence, motion } from "motion/react";
import Icon from "@/components/icon/Icon";
import type { Status } from "../../types";
import "./StatusIcon.css";
import BuildingIcon from "./_svg/BuildingIcon.svg?react";
import QueuedIcon from "./_svg/QueuedIcon.svg?react";
export default function StatusIcon({ status }: { status: Status }) {
  return (
    <div className="relative flex-center size-20">
      <AnimatePresence initial={false}>
        <motion.div
          key={status}
          initial={{ filter: "blur(2px)", opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ filter: "blur(2px)", opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.3 }}
          className="center absolute"
        >
          {status === "Deployed" && (
            <Icon name="checkmark-1-medium" className="size-20" />
          )}

          {status === "Queued" && <QueuedIcon className="queued-icon-rotate" />}

          {status === "Building" && (
            <BuildingIcon className="building-icon-rotate text-border-dashed" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
