import { Graphics } from "pixi.js";
import type { Ticker } from "../components/pixi";
import { getComponentDefinition } from "../components/componentRegistry";
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

    const { width, height } = getComponentDefinition(inst.type);
    graphics.rect(inst.x + 0.5, inst.y + 0.5, width - 1, height - 1).stroke({ width: 1, color: 0x9fc8ff });
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
