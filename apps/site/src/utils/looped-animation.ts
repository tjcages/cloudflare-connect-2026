import { sleepVisible } from "./visibility-timers";

const STOP = Symbol("looped-animation-stop");

export type LoopedAnimationContext = {
  /** Resolves once `ms` has elapsed on screen. Ends the cycle if the loop stops. */
  sleep: (ms: number) => Promise<void>;
};

export function createLoopedAnimation(
  cycle: (context: LoopedAnimationContext) => Promise<void>,
  element: HTMLElement
) {
  const controller = new AbortController();
  const { signal } = controller;

  const sleep = async (ms: number) => {
    const completed = await sleepVisible(element, ms, { signal });
    if (!completed) throw STOP;
  };

  (async () => {
    while (!signal.aborted) {
      try {
        await cycle({ sleep });
      } catch (error) {
        if (error === STOP) return;
        throw error;
      }
    }
  })();

  return () => controller.abort();
}
