import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
import Icon from "@/components/icon/Icon";

const SWAP_TRANSITION = { duration: 0.25, ease: [0.6, 0.6, 0, 1] as const };

function copyFeedbackLabelClass(align: "start" | "center"): string {
  switch (align) {
    case "center":
      return "relative inline-grid justify-items-center overflow-hidden";
    case "start":
      return "relative inline-grid justify-items-start overflow-hidden";
    default: {
      const _exhaustive: never = align;
      throw new Error(`Unhandled copy label align: ${_exhaustive}`);
    }
  }
}

export function useCopyFeedback(value: string) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timeoutRef.current);
    },
    []
  );

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return { copied, copy };
}

export function CopyFeedbackIcon({
  className,
  copied,
}: {
  className?: string;
  copied: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex size-20 shrink-0 items-center justify-center",
        className
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center"
          exit={{ filter: "blur(3px)", opacity: 0, scale: 0.5 }}
          initial={{ filter: "blur(3px)", opacity: 0, scale: 0.5 }}
          key={`${copied}`}
          transition={SWAP_TRANSITION}
        >
          <Icon
            name={copied ? "checkmark-1-medium" : "square-behind-square-2"}
            size={20}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function CopyFeedbackLabel({
  align = "start",
  copied,
  idle,
  copiedLabel = "Copied",
}: {
  align?: "start" | "center";
  copied: boolean;
  idle: string;
  copiedLabel?: string;
}) {
  const text = copied ? copiedLabel : idle;
  return (
    <span className={copyFeedbackLabelClass(align)}>
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
      >
        {idle}
      </span>
      <span className="col-start-1 row-start-1 overflow-hidden whitespace-nowrap">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ filter: "blur(0px)", opacity: 1, x: 0 }}
            className="inline-block whitespace-nowrap"
            exit={{ filter: "blur(3px)", opacity: 0, x: -8 }}
            initial={{ filter: "blur(3px)", opacity: 0, x: 8 }}
            key={text}
            transition={SWAP_TRANSITION}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
