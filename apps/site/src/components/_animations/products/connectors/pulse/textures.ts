import { Texture } from "pixi.js";

const RING_TEX = 256;
const RING_PEAK = 0.78;
export const RING_BAND = RING_PEAK * (RING_TEX / 2);

let ring: Texture | null = null;
export function getRingTexture(): Texture {
  if (ring) return ring;
  const c = document.createElement("canvas");
  c.width = RING_TEX;
  c.height = RING_TEX;
  const g = c.getContext("2d");
  if (g) {
    const r = RING_TEX / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.14)");
    grad.addColorStop(RING_PEAK, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, RING_TEX, RING_TEX);
  }
  ring = Texture.from(c);
  return ring;
}
