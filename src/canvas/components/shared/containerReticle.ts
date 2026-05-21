import { Graphics } from "pixi.js";

export const CONTAINER_RETICLE_PX = 22;

export const buildContainerCornerReticle = (tickColor: number, centerDotColor: number): Graphics => {
  const g = new Graphics();
  g.roundRect(0, 0, CONTAINER_RETICLE_PX, CONTAINER_RETICLE_PX, 11).fill({ color: 0xffffff });
  g.rect(10.5, 4, 1, 2).fill({ color: tickColor });
  g.rect(10.5, 16, 1, 2).fill({ color: tickColor });
  g.rect(4, 10.5, 2, 1).fill({ color: tickColor });
  g.rect(16, 10.5, 2, 1).fill({ color: tickColor });
  g.roundRect(10, 10, 2, 2, 1).fill({ color: centerDotColor });
  return g;
};

export type ContainerReticleCorner = "tl" | "tr" | "bl" | "br";

const CONTAINER_RETICLE_POSITION_NUDGE_PX = 0.5;

/** Top-left position for a reticle centered on a corner of a width×height box. */
export const getContainerReticlePosition = (
  corner: ContainerReticleCorner,
  width: number,
  height: number,
): { x: number; y: number } => {
  const half = CONTAINER_RETICLE_PX / 2;
  const n = CONTAINER_RETICLE_POSITION_NUDGE_PX;
  switch (corner) {
    case "tl":
      return { x: -half + n, y: -half + n };
    case "tr":
      return { x: width - half + n, y: -half + n };
    case "bl":
      return { x: -half + n, y: height - half + n };
    case "br":
      return { x: width - half + n, y: height - half + n };
  }
};
