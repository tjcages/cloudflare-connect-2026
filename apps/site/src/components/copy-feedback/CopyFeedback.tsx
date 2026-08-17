import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/icon/Icon";

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
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
        className={className}
        exit={{ filter: "blur(3px)", opacity: 0, scale: 0.5 }}
        initial={{ filter: "blur(3px)", opacity: 0, scale: 0.5 }}
        key={`${copied}`}
        transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
      >
        <Icon
          name={copied ? "checkmark-1-medium" : "square-behind-square-2"}
          size={20}
        />
      </motion.span>
    </AnimatePresence>
  );
}
