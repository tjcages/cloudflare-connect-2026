import type { animate } from "motion";

declare module "pixi.js" {
  interface Application {
    animate: (
      ...args: Parameters<typeof animate>
    ) => ReturnType<typeof animate>;
  }

  interface Ticker {
    interval: (ms: number, callback?: () => void) => () => void;
    wait: (ms: number, callback?: () => void) => Promise<void>;
  }
}
