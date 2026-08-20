import { motion } from "motion/react";
import { createPortal } from "react-dom";
import Icon from "@/components/icon/Icon";

const SHARE_EASE = [0.6, 0.6, 0, 1] as const;

export default function BadgeShareDock({
  src,
  title,
  onDismiss,
}: {
  src: string;
  title: string;
  onDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10000 flex justify-center p-24 max-sm:p-16">
      <motion.div
        animate={{ filter: "blur(0px)", opacity: 1, scale: 1, y: 0 }}
        className="pointer-events-auto w-full max-w-280 origin-bottom"
        exit={{ filter: "blur(6px)", opacity: 0, scale: 0.88, y: 16 }}
        initial={{ filter: "blur(6px)", opacity: 0, scale: 0.88, y: 16 }}
        transition={{ duration: 0.35, ease: SHARE_EASE }}
      >
        <div className="relative overflow-hidden rounded-16 bg-background-base shadow-elevation-default-drops">
          <button
            aria-label="Dismiss shareable card"
            className="absolute top-8 right-8 z-3 flex size-32 cursor-pointer items-center justify-center rounded-full bg-background-base text-icon-muted opacity-40 transition-opacity hover:bg-background-faint hover:text-icon-base hover:opacity-100 focus-visible:bg-background-ghost focus-visible:opacity-100 focus-visible:shadow-button-tertiary-focus focus-visible:outline-none"
            onClick={onDismiss}
            type="button"
          >
            <Icon name="cross-small" size={20} />
          </button>
          <img alt={title} className="block w-full" draggable src={src} />
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
