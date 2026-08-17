const FADE_LENGTH = 24;
export const CAP_WIDTH = 6;
export const CAP_HEIGHT = 9;

type CapSide = "left" | "right";

export function scoopCaretPath(ox = 0, oy = 0, dir = 1): string {
  const x = (px: number) => ox + dir * px;
  const y = (py: number) => oy + py;
  return [
    `M${x(0)} ${y(0)}`,
    `C${x(0)} ${y(2.20914)} ${x(1.79086)} ${y(4)} ${x(4)} ${y(4)}`,
    `L${x(6)} ${y(4)}`,
    `L${x(6)} ${y(5)}`,
    `L${x(4)} ${y(5)}`,
    `C${x(1.79086)} ${y(5)} ${x(0)} ${y(6.79086)} ${x(0)} ${y(9)}`,
    "Z",
  ].join(" ");
}

export function capTransform(x: number, y: number, side: CapSide): string {
  const base = `translate(${x} ${y - CAP_HEIGHT / 2})`;
  return side === "left" ? `${base} scale(-1 1)` : base;
}

export function capFade(x: number, side: CapSide): { x1: number; x2: number } {
  const away = side === "right" ? 1 : -1;
  const x1 = x + away * CAP_WIDTH;
  const x2 = x1 + away * FADE_LENGTH;
  return { x1, x2 };
}
