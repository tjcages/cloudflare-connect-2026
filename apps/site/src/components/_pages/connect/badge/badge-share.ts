export const BADGE_SHARE_WIDTH = 1600;
export const BADGE_SHARE_HEIGHT = 900;

export function badgeShareHeadline(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "My Connect 2026 badge";
  return `${trimmed}'s Connect 2026 badge`;
}

export function badgeTweetUrl(headline: string, pageUrl: string): string {
  const text = `${headline}\n${pageUrl}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (source.width < 2 || source.height < 2) return;
  const scale = Math.max(w / source.width, h / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function composeBadgeShareCard({
  backdrop,
  face,
  title,
}: {
  backdrop: HTMLCanvasElement | null;
  face: HTMLCanvasElement | null;
  title: string;
}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BADGE_SHARE_WIDTH;
  canvas.height = BADGE_SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, BADGE_SHARE_WIDTH, BADGE_SHARE_HEIGHT);
  if (backdrop) {
    drawCover(ctx, backdrop, 0, 0, BADGE_SHARE_WIDTH, BADGE_SHARE_HEIGHT);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, 0, BADGE_SHARE_WIDTH, BADGE_SHARE_HEIGHT);

  if (face && face.width > 1 && face.height > 1) {
    const cardH = BADGE_SHARE_HEIGHT * 0.68;
    const cardW = cardH * (face.width / face.height);
    const cardX = (BADGE_SHARE_WIDTH - cardW) / 2;
    const cardY = BADGE_SHARE_HEIGHT * 0.08;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 18;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.clip();
    ctx.shadowColor = "transparent";
    ctx.drawImage(face, cardX, cardY, cardW, cardH);
    ctx.restore();
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 32px "STK Bureau Sans", sans-serif`;
  ctx.fillText(title, BADGE_SHARE_WIDTH / 2, BADGE_SHARE_HEIGHT - 56);
  return canvas;
}

export async function copyCanvasImage(
  canvas: HTMLCanvasElement
): Promise<{ url: string; copied: boolean }> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) resolve(next);
      else reject(new Error("Could not export the card."));
    }, "image/png");
  });
  let copied = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copied = true;
  } catch {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": Promise.resolve(blob) }),
      ]);
      copied = true;
    } catch {
      // Preview still lets someone save the image.
    }
  }
  return { url: URL.createObjectURL(blob), copied };
}
