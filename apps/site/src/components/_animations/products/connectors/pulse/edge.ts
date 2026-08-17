import { CELL_SIZE, PLATE_INSET } from "../../../constants";
import type { IProductsBox } from "../../box/types";
import { CANVAS_WIDTH, resolveOuterSpan } from "../utils/outer";

function edgeNode(
  box: IProductsBox,
  side: "left" | "right",
  canvasWidth: number
): IProductsBox {
  const x =
    side === "left" ? PLATE_INSET - CELL_SIZE : canvasWidth - PLATE_INSET;
  return {
    ...box,
    id: `${box.id}__edge`,
    size: 1,
    position: { x, y: box.position.y },
    connectTo: undefined,
    connectToEdge: undefined,
  };
}

export function augmentWithEdges(
  boxes: IProductsBox[],
  canvasWidth = CANVAS_WIDTH
): {
  nodes: IProductsBox[];
  synthIds: Set<string>;
} {
  const synthIds = new Set<string>();
  const extra: IProductsBox[] = [];

  const nodes = boxes.map((box) => {
    if (!box.connectToEdge) {
      return box;
    }

    const { side } = resolveOuterSpan(box, canvasWidth);
    const synth = edgeNode(box, side, canvasWidth);
    synthIds.add(synth.id);
    extra.push(synth);

    if (side === "left") {
      synth.connectTo = [box.id];
      return box;
    }

    return { ...box, connectTo: [...(box.connectTo ?? []), synth.id] };
  });

  return { nodes: [...nodes, ...extra], synthIds };
}
