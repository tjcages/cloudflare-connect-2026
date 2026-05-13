import { Graphics } from "pixi.js";
import type { Ticker } from "../components/pixi";
import { getInstanceCanvasBounds } from "../components/componentRegistry";
import { useAppStore } from "../store";

export const setupSelectionLayer: Ticker = ({ app, cleanup }) => {
  const graphics = new Graphics();
  app.stage.addChild(graphics);

  const sync = () => {
    graphics.clear();

    const { selectedInstanceId, instances } = useAppStore.getState();
    if (selectedInstanceId === null) {
      return;
    }

    const inst = instances.find((i) => i.id === selectedInstanceId);
    if (!inst) {
      return;
    }

    const b = getInstanceCanvasBounds(inst);
    let w = b.width;
    let h = b.height;
    /** Icon-box: selection stroke +1px wider/taller; origin unchanged from bounds. */
    if (inst.type === "icon-box") {
      w += 1;
      h += 1;
    }
    graphics.rect(b.x + 0.5, b.y + 0.5, w - 1, h - 1).stroke({ width: 1, color: 0x9fc8ff });
  };

  sync();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (state.selectedInstanceId !== prev.selectedInstanceId || state.instances !== prev.instances) {
      sync();
      app.render();
    }
  });

  cleanup(() => {
    unsub();
    graphics.destroy(true);
  });
};
