import { Sprite, Texture } from "pixi.js";
import type { Anchor, Point } from "./geometry";

const EMERGE = 6;

// Soft alpha mask; also clips any path that runs past the target caret.
export function createEmergeMask(
  points: Point[],
  from: Anchor,
  to: Anchor,
  // Edge connectors fade over the whole tail of the line rather than a hairline,
  // so the snake dies out exactly where the line it rides does.
  { sourceFade = EMERGE, targetFade = EMERGE } = {}
): Sprite {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const margin = 8;
  const x = Math.min(...xs) - margin;
  const y = Math.min(...ys) - margin;
  const width = Math.ceil(Math.max(...xs) - x + margin);
  const height = Math.ceil(Math.max(...ys) - y + margin);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "destination-out";

    const sourceDir = from.side === "right" ? 1 : -1;
    const sourceX = from.x - x;
    const sourceGradient = ctx.createLinearGradient(
      sourceX,
      0,
      sourceX + sourceDir * sourceFade,
      0
    );
    sourceGradient.addColorStop(0, "rgba(0,0,0,1)");
    sourceGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sourceGradient;
    ctx.fillRect(
      Math.min(sourceX, sourceX + sourceDir * sourceFade) - 2,
      0,
      sourceFade + 4,
      height
    );

    const targetDir = to.side === "left" ? 1 : -1;
    const targetX = to.x - x;
    const targetGradient = ctx.createLinearGradient(
      targetX - targetDir * targetFade,
      0,
      targetX,
      0
    );
    targetGradient.addColorStop(0, "rgba(0,0,0,0)");
    targetGradient.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = targetGradient;
    const fillX = targetDir > 0 ? targetX - targetDir * targetFade - 2 : 0;
    const fillW = targetDir > 0 ? width - fillX : targetX + targetFade + 2;
    ctx.fillRect(fillX, 0, fillW, height);
  }

  const sprite = new Sprite(Texture.from(canvas));
  sprite.position.set(x, y);
  return sprite;
}
