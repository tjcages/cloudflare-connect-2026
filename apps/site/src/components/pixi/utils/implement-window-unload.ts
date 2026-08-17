import type { Application } from "pixi.js";

export const implementWindowUnload = ({
  app,
  cleanup,
}: {
  app: Application;
  cleanup: (fn: () => void) => void;
}) => {
  const beforeUnloadHandler = () => app.ticker.stop();

  window.addEventListener("beforeunload", beforeUnloadHandler);

  cleanup(() =>
    window.removeEventListener("beforeunload", beforeUnloadHandler)
  );
};
