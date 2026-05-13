import { getInstanceCanvasBounds } from "../components/componentRegistry";
import type { ComponentInstance } from "../grid/types";

export const hitTestComponentInstances = (instances: ComponentInstance[], x: number, y: number) => {
  for (let index = instances.length - 1; index >= 0; index -= 1) {
    const instance = instances[index];
    const b = getInstanceCanvasBounds(instance);

    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return instance;
    }
  }

  return undefined;
};
