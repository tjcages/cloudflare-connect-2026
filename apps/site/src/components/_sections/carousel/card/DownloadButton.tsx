import DownloadIcon from "./_svg/DownloadIcon.svg?react";
import { motion } from "motion/react";
import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";

export default function DownloadButton({
  title,
  iconName,
}: {
  title: string;
  iconName: IconName;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(2px)", scale: 0.8 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(2px)", scale: 0.8 }}
      transition={{
        duration: 0.35,
        ease: [0.6, 0.6, 0, 1],
      }}
      className="flex-center h-full w-full"
    >
      <div className="flex-center w-max rounded-full pr-12 pl-10 shadow-elevation-default">
        <div className="relative flex-center py-8 before:inside-border-r before:border-border-default">
          <Icon name={iconName} size={20} variant="duo" />

          <div className="pr-14 pl-8 text-label-x-small text-text-base">
            {title}
          </div>
        </div>
        <div className="pl-8">
          <DownloadIcon />
        </div>
      </div>
    </motion.div>
  );
}
