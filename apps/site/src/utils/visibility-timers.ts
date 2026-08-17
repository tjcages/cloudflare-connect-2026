export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function observeVisibility(
  element: Element,
  threshold: number,
  onChange: (visible: boolean) => void
) {
  let elementVisible = false;
  let documentVisible = !document.hidden;

  const notify = () => onChange(elementVisible && documentVisible);

  const observer = new IntersectionObserver(
    (entries) => {
      elementVisible = entries.at(-1)?.isIntersecting ?? false;
      notify();
    },
    { threshold }
  );
  observer.observe(element);

  const onVisibilityChange = () => {
    documentVisible = !document.hidden;
    notify();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function sleepVisible(
  element: HTMLElement,
  ms: number,
  {
    threshold = 0.01,
    signal,
  }: { threshold?: number; signal?: AbortSignal } = {}
) {
  return new Promise<boolean>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let stopTracking = () => {};

    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      stopTracking();
      signal?.removeEventListener("abort", onAbort);
      resolve(completed);
    };

    const onAbort = () => finish(false);

    if (signal?.aborted) {
      finish(false);
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    stopTracking = observeVisibility(element, threshold, (visible) => {
      if (visible && !timer) {
        timer = setTimeout(() => finish(true), ms);
      } else if (!visible && timer) {
        clearTimeout(timer);
        timer = null;
      }
    });
  });
}

export function setTimeoutOnVisible({
  element,
  callback,
  timeout,
  threshold = 0.01,
  onStart,
  onPause,
}: {
  element?: Element | HTMLElement | null;
  callback: () => void;
  onStart?: () => void;
  onPause?: () => void;
  timeout: number;
  threshold?: number;
}) {
  if (!element) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;

  const stopTracking = observeVisibility(element, threshold, (visible) => {
    if (finished) return;

    if (visible && !timer) {
      onStart?.();
      timer = setTimeout(() => {
        finished = true;
        timer = null;
        stopTracking();
        callback();
      }, timeout);
    } else if (!visible && timer) {
      onPause?.();
      clearTimeout(timer);
      timer = null;
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    stopTracking();
  };
}

export function setIntervalOnVisible({
  element,
  callback,
  interval,
  threshold = 0.01,
  immediateWhenVisible = false,
}: {
  element?: Element | HTMLElement | null;
  callback: () => void;
  interval: number;
  threshold?: number;
  immediateWhenVisible?: boolean;
}) {
  if (!element) throw new Error("Element is required");

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isVisible = false;
  let isPaused = false;
  let ranOnce = false;

  const startInterval = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(callback, interval);
  };

  const stopInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const canRun = () => isVisible && !isPaused;

  const stopTracking = observeVisibility(element, threshold, (visible) => {
    isVisible = visible;

    if (visible) {
      if (immediateWhenVisible && !ranOnce) {
        ranOnce = true;
        callback();
      }
      if (canRun() && !intervalId) startInterval();
    } else {
      stopInterval();
    }
  });

  return {
    cleanup: () => {
      stopInterval();
      stopTracking();
    },
    reset: () => {
      if (canRun()) startInterval();
    },
    runOnce: () => {
      if (!isVisible) return;
      callback();
      if (canRun()) startInterval();
    },
    pause: () => {
      isPaused = true;
      stopInterval();
    },
    resume: () => {
      isPaused = false;
      if (canRun()) startInterval();
    },
  };
}
