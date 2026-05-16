import { Graphics } from "pixi.js";
import type { Ticker } from "../../components/pixi";
import type { GeneratedGrid } from "../../grid/types";
import { parseHexColor } from "../color";
import { useAppStore } from "../../store";

const paintGrid = (graphics: Graphics, grid: GeneratedGrid) => {
  graphics.clear();

  graphics.rect(0, 0, grid.config.logicalWidth, grid.config.logicalHeight).fill({ color: 0xffffff });

  const strokeColor = parseHexColor(grid.config.strokeColor);

  for (const cell of grid.cells) {
    graphics.rect(cell.x + 0.5, cell.y + 0.5, cell.width, cell.height).stroke({ width: 1, color: strokeColor });
  }
};

export const setupGridLayer: Ticker = ({ app, cleanup }) => {
  const graphics = new Graphics();
  app.stage.addChildAt(graphics, 0);

  paintGrid(graphics, useAppStore.getState().grid);
  graphics.cacheAsTexture(true);

  const unsub = useAppStore.subscribe((state, prev) => {
    if (state.grid !== prev.grid) {
      paintGrid(graphics, state.grid);
      graphics.updateCacheTexture();
    }
  });

  cleanup(() => {
    unsub();
    graphics.destroy(true);
  });
};
