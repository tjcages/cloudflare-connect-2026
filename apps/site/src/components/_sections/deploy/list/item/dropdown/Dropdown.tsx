import { AnimatePresence, motion } from "motion/react";
import ArrowRotateIcon from "./_svg/ArrowRotateIcon.svg?react";
import HistoryIcon from "./_svg/HistoryIcon.svg?react";
import TrashCanIcon from "./_svg/TrashCanIcon.svg?react";
import DeployListItemDropdownItem from "./Item";
import type { ListType } from "../../types";

export default function DeployListItemDropdown({
  activeItem,
  activeIndex,
}: {
  activeItem: ListType | undefined;
  activeIndex: number;
}) {
  return (
    <AnimatePresence>
      {activeItem && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: activeIndex * 72 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: activeIndex * 72,
          }}
          exit={{ scale: 0.9, opacity: 0, y: activeIndex * 72 }}
          className="absolute top-60 right-20 z-50 w-full max-w-232 rounded-12 bg-background-base p-4 shadow-elevation-default"
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 19,
            delay: 0.1,
          }}
          key={activeItem.id}
        >
          <DeployListItemDropdownItem
            label="Rollback to this deployment"
            icon={<HistoryIcon />}
            hovered
          />
          <DeployListItemDropdownItem
            label="Retry deployment"
            icon={<ArrowRotateIcon />}
          />
          <div className="px-10 pt-6 pb-5">
            <div className="h-1 w-full bg-border-muted" />
          </div>

          <DeployListItemDropdownItem
            color="red"
            label="Delete deployment"
            icon={<TrashCanIcon />}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
