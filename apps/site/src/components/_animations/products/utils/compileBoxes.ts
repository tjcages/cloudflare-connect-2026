import { nanoid } from "nanoid";
import type { IProductsBox } from "../box/types";

export function compileBoxes(boxes: IProductsBox[]): IProductsBox[] {
  const idMap = new Map(boxes.map((box) => [box.id, `${box.id}-${nanoid()}`]));
  return boxes.map((box) => ({
    ...box,
    id: idMap.get(box.id)!,
    connectTo: box.connectTo?.map((id) => idMap.get(id) ?? id),
  }));
}
