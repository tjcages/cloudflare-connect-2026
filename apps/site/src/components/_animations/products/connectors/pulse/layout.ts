import { CELL_SIZE, PLATE_INSET } from "../../../constants";
import type { IProductsBox } from "../../box/types";
import { CAP_WIDTH } from "../../../ui/utils/caret-path";
import { boxRect, resolveAnchors } from "../utils/geometry";
import type {
  Anchor,
  Point,
} from "@/components/_animations/shared/snake-pulse/geometry";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";

export type Plate = { x: number; y: number; w: number; h: number };

type ConnectorLayout = {
  from: Anchor;
  to: Anchor;
  plate: Plate;
  points: Point[];
  caret: Point;
  endFraction: number;
};

export function connectorLayout(
  source: IProductsBox,
  target: IProductsBox
): ConnectorLayout {
  const { from, to } = resolveAnchors(source, target);
  const box = boxRect(target);
  const plate = {
    x: box.left + PLATE_INSET,
    y: box.top + PLATE_INSET,
    w: box.width - 2 * PLATE_INSET,
    h: CELL_SIZE - 2 * PLATE_INSET,
  };

  const dir = to.side === "left" ? 1 : -1;
  const { points, endFraction } = buildConnector(from, to);

  return {
    from,
    to,
    plate,
    points,
    caret: { x: to.x - dir * CAP_WIDTH, y: to.y },
    endFraction,
  };
}
