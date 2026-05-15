import { useCallback, useRef } from "react";
import type { UIEvent } from "react";

/** Adds `ui-scroll-thumb-active` briefly on scroll so overlay scrollbars show while scrolling. */
export const useScrollbarThumbFlash = () => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((event: UIEvent<HTMLElement>) => {
    const el = event.currentTarget;
    el.classList.add("ui-scroll-thumb-active");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      el.classList.remove("ui-scroll-thumb-active");
      timeoutRef.current = null;
    }, 700);
  }, []);
};
