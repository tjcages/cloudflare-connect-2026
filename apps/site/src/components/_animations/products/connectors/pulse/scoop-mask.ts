import { Graphics } from "pixi.js";
import { CAP_HEIGHT, scoopCaretPath } from "../../../ui/utils/caret-path";
import { scoopPath } from "../../../ui/utils/plate-path";
import type { Anchor } from "@/components/_animations/shared/snake-pulse/geometry";
import type { Plate } from "./layout";

export function createScoopMask(plate: Plate, to: Anchor): Graphics {
  const sign = to.side === "left" ? -1 : 1;
  const caret = scoopCaretPath(
    to.x - plate.x,
    to.y - plate.y - CAP_HEIGHT / 2,
    sign
  );

  const mask = new Graphics();
  mask.svg(
    `<svg><path d="${scoopPath(plate.w, plate.h)}" fill="#fff"/><path d="${caret}" fill="#fff"/></svg>`
  );
  mask.position.set(plate.x, plate.y);
  return mask;
}
