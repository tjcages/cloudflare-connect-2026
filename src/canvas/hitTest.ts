import { getComponentDefinition } from "../components/componentRegistry";
import type { ComponentInstance } from "../grid/types";

export const hitTestComponentInstances = (instances: ComponentInstance[], x: number, y: number) => {
  for (let index = instances.length - 1; index >= 0; index -= 1) {
    const instance = instances[index];
    const definition = getComponentDefinition(instance.type);

    if (
      x >= instance.x &&
      x <= instance.x + definition.width &&
      y >= instance.y &&
      y <= instance.y + definition.height
    ) {
      return instance;
    }
  }

  return undefined;
};
