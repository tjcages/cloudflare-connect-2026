import { type Graphics, Sprite } from "pixi.js";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { getRingTexture } from "./textures";
import { resolveDynamicColor } from "@/components/_animations/shared/snake-pulse/resolve-color";

const WAVE_STEP = 2;

export function createRing(
  caret: Point,
  color: string,
  mask: Graphics
): Sprite {
  const ring = new Sprite(getRingTexture());
  ring.anchor.set(0.5);
  ring.position.set(caret.x, caret.y);
  ring.tint = resolveDynamicColor(color, WAVE_STEP);
  ring.visible = false;
  ring.mask = mask;

  addEventListener("themechange", () => {
    ring.tint = resolveDynamicColor(color, WAVE_STEP);
  });

  return ring;
}
