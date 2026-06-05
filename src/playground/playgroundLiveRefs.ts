import { useCallback, useEffect, useRef } from "react";

/** Throttle interval for React state commits during slider scrubbing (ms). */
export const PLAYGROUND_SCRUB_COMMIT_MS = 32;

export function useThrottledCallback<T extends (...args: never[]) => void>(callback: T, delayMs: number): T {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      pendingRef.current = args;
      if (timerRef.current) {
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) {
          callbackRef.current(...pending);
        }
      }, delayMs);
    }) as T,
    [delayMs],
  );
}
