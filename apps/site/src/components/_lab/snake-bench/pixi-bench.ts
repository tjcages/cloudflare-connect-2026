import { Container } from "pixi.js";
import { createSnake } from "@/components/_animations/shared/snake-pulse/snake";
import type { Ticker } from "@/components/pixi/Pixi";
import { benchLayouts, benchStats, createDriver } from "./bench";

export function pixiBench(count: number, bent: boolean): Ticker {
  return ({ app, cleanup }) => {
    const layer = new Container();
    app.stage.addChild(layer);

    const entries = benchLayouts(count, bent).map((layout) => {
      const snake = createSnake(layout, "orange", "orange", {
        taper: false,
        emergeMask: false,
      });
      layer.addChild(snake.container);
      return { snake, layout };
    });

    const drive = createDriver(entries);
    let elapsed = 0;

    const tick = ({ deltaMS }: { deltaMS: number }) => {
      const started = performance.now();
      elapsed += deltaMS / 1000;
      drive(elapsed);
      const ended = performance.now();
      benchStats.frame(ended, ended - started);
    };

    app.ticker.add(tick);
    cleanup(() => {
      app.ticker.remove(tick);
      for (const entry of entries) entry.snake.destroy();
    });
  };
}
