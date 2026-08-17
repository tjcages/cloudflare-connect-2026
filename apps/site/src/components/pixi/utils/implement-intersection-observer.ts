import type { Application } from "pixi.js";
import type { implementSafeTickers } from "./implement-safe-tickers";

export const implementIntersectionObserver = ({
  state,
  cleanup,
  app,
}: {
  state: ReturnType<typeof implementSafeTickers>;
  cleanup: (fn: () => void) => void;
  app: Application;
}) => {
  const observer = new IntersectionObserver(([entry]) => {
    state.isIntersecting = entry.isIntersecting;
  });

  observer.observe(app.canvas);

  cleanup(() => observer.disconnect());
};
