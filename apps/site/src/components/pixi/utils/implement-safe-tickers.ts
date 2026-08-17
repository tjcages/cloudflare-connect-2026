import type { Application, Ticker } from "pixi.js";

export const implementSafeTickers = (
  app: Application,
  events: {
    onStart: () => void;
    onStop: () => void;
  }
) => {
  const state = new Proxy(
    {
      tickerCount: 0,
      documentVisible: true,
      isIntersecting: true,
      overlayCovered: false,
    },
    {
      set(target, prop, value) {
        target[prop as keyof typeof target] = value as never;

        if (
          target.tickerCount > 0 &&
          target.documentVisible &&
          target.isIntersecting &&
          !target.overlayCovered
        ) {
          events.onStart();
        } else {
          events.onStop();
        }

        return true;
      },
    }
  );

  const originalAdd = app.ticker.add.bind(app.ticker);
  const originalRemove = app.ticker.remove.bind(app.ticker);

  app.ticker.add = (...args: Parameters<Ticker["add"]>) => {
    if (!app.ticker) return undefined as unknown as ReturnType<Ticker["add"]>;

    state.tickerCount += 1;

    return originalAdd(...args);
  };

  app.ticker.remove = (...args: Parameters<Ticker["remove"]>) => {
    if (!app.ticker)
      return undefined as unknown as ReturnType<Ticker["remove"]>;

    state.tickerCount -= 1;

    return originalRemove(...args);
  };

  return state;
};
