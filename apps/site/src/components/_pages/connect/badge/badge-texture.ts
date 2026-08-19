import type { BadgeRole } from "./badge-params";
import type { BadgeTheme } from "./badge-themes";

export type BadgeFace = {
  name: string;
  company: string;
  serial: string;
  role: BadgeRole;
  theme: BadgeTheme;
  hash: number;
};

const WIDTH = 1024;
const HEIGHT = 1408;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillTextFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string
) {
  ctx.font = font;
  let output = text;
  if (ctx.measureText(output).width <= maxWidth) {
    ctx.fillText(output, x, y);
    return;
  }
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  ctx.fillText(`${output}…`, x, y);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, 28);
  ctx.bezierCurveTo(4, 28, 0, 22, 2, 16);
  ctx.bezierCurveTo(-2, 10, 6, 4, 14, 8);
  ctx.bezierCurveTo(18, 2, 30, 2, 34, 10);
  ctx.bezierCurveTo(42, 8, 48, 16, 44, 22);
  ctx.bezierCurveTo(50, 24, 48, 32, 40, 32);
  ctx.lineTo(14, 32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHashMark(
  ctx: CanvasRenderingContext2D,
  hash: number,
  colors: readonly string[],
  x: number,
  y: number,
  w: number,
  h: number
) {
  const cells = 16;
  const gap = 4;
  const cellW = (w - gap * (cells - 1)) / cells;
  for (let index = 0; index < cells; index += 1) {
    const bit = (hash >>> (index % 32)) & 1;
    const mix = (hash >>> ((index * 3) % 24)) & 7;
    const color = colors[(mix + index) % colors.length] ?? colors[0];
    ctx.globalAlpha = bit ? 1 : 0.28;
    ctx.fillStyle = color ?? "#f46021";
    ctx.fillRect(x + index * (cellW + gap), y, cellW, h);
  }
  ctx.globalAlpha = 1;
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  face: BadgeFace,
  side: "front" | "back"
) {
  const { theme, role, name, company, serial, hash } = face;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#fdfdfd";
  roundedRect(ctx, 0, 0, WIDTH, HEIGHT, 72);
  ctx.fill();

  const headerH = 320;
  const headerGrad = ctx.createLinearGradient(0, 0, WIDTH, headerH);
  headerGrad.addColorStop(0, theme.accent);
  headerGrad.addColorStop(1, theme.pair);
  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  ctx.moveTo(0, 72);
  ctx.arcTo(0, 0, 72, 0, 72);
  ctx.arcTo(WIDTH, 0, WIDTH, 72, 72);
  ctx.lineTo(WIDTH, headerH);
  ctx.lineTo(0, headerH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  drawCloud(ctx, 72, 88, 2.1, "#ffffff");
  ctx.font = "600 28px 'STK Bureau Sans', sans-serif";
  ctx.fillText("CLOUDFLARE", 200, 128);
  ctx.font = "400 28px 'STK Bureau Sans', sans-serif";
  ctx.fillText("CONNECT 2026", 200, 168);

  ctx.font = "500 22px 'Paper Mono', ui-monospace, monospace";
  ctx.fillText(`#${serial}`, 72, 250);

  drawHashMark(
    ctx,
    hash,
    theme.stripeHexes.slice(-6),
    72,
    headerH - 36,
    WIDTH - 144,
    16
  );

  if (side === "front") {
    ctx.fillStyle = "#292929";
    fillTextFit(
      ctx,
      name,
      72,
      560,
      WIDTH - 144,
      "400 92px 'STK Bureau Sans', sans-serif"
    );
    ctx.fillStyle = "#5c5c5c";
    fillTextFit(
      ctx,
      company,
      72,
      660,
      WIDTH - 144,
      "400 42px 'STK Bureau Sans', sans-serif"
    );

    ctx.fillStyle = theme.accent;
    roundedRect(ctx, 72, 760, 280, 64, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 28px 'STK Bureau Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(role.label.toUpperCase(), 72 + 140, 802);
    ctx.textAlign = "left";

    ctx.fillStyle = "#8f8f8f";
    ctx.font = "400 22px 'Paper Mono', ui-monospace, monospace";
    ctx.fillText("OCT 19–21  ·  MOSCONE WEST", 72, 1280);
    ctx.fillText("SAN FRANCISCO", 72, 1320);
  } else {
    const bandY = 420;
    const bandH = 640;
    const colors = theme.stripeHexes;
    const slice = bandH / colors.length;
    for (let index = 0; index < colors.length; index += 1) {
      ctx.fillStyle = colors[index] ?? theme.accent;
      ctx.fillRect(0, bandY + index * slice, WIDTH, slice + 1);
    }

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    roundedRect(ctx, 96, 620, WIDTH - 192, 240, 24);
    ctx.fill();
    ctx.fillStyle = "#292929";
    ctx.textAlign = "center";
    ctx.font = "500 28px 'STK Bureau Sans', sans-serif";
    ctx.fillText("CLOUDFLARE CONNECT", WIDTH / 2, 700);
    ctx.font = "500 48px 'Paper Mono', ui-monospace, monospace";
    ctx.fillText(`#${serial}`, WIDTH / 2, 780);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 4;
  roundedRect(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 70);
  ctx.stroke();
}

export function createBadgeCanvases(face: BadgeFace): {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
} {
  const front = document.createElement("canvas");
  front.width = WIDTH;
  front.height = HEIGHT;
  const back = document.createElement("canvas");
  back.width = WIDTH;
  back.height = HEIGHT;
  const frontCtx = front.getContext("2d");
  const backCtx = back.getContext("2d");
  if (!frontCtx || !backCtx) {
    throw new Error("Badge texture canvas is unavailable.");
  }
  drawFace(frontCtx, face, "front");
  drawFace(backCtx, face, "back");
  return { front, back };
}
