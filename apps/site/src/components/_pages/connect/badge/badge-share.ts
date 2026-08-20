import { toCanvas } from "html-to-image";

export const BADGE_SHARE_SURFACE = "#ffffff";
export const BADGE_SHARE_GRID_LINE = "#f4f4f4";
export const BADGE_SHARE_GRID = 80;
export const BADGE_SHARE_TITLE_X = 80;
export const BADGE_SHARE_TITLE_SIZE = 44;

export function badgeShareHeadline(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "My Connect 2026 badge";
  return `${trimmed}'s Connect 2026 badge`;
}

export function badgeTweetUrl(headline: string, pageUrl: string): string {
  const text = `${headline}\n${pageUrl}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export function keepShareNode(node: HTMLElement): boolean {
  return !node.hasAttribute("data-share-hide");
}

function waitTwoFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function drawShareGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = BADGE_SHARE_SURFACE;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = BADGE_SHARE_GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += BADGE_SHARE_GRID) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += BADGE_SHARE_GRID) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
}

function stampShareCanvas(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  hero: DOMRect
) {
  if (source.width < 2 || source.height < 2) return;
  if (!("shareStamp" in source.dataset)) return;
  const box = source.getBoundingClientRect();
  ctx.drawImage(
    source,
    box.left - hero.left,
    box.top - hero.top,
    box.width,
    box.height
  );
}

async function paintShareTitle(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  box: DOMRect,
  headline: string,
  pixelRatio: number
) {
  const title = hero.querySelector<HTMLElement>("[data-share-title]");
  if (title) {
    const titleBox = title.getBoundingClientRect();
    try {
      const titleCanvas = await toCanvas(title, {
        cacheBust: true,
        pixelRatio,
      });
      ctx.drawImage(
        titleCanvas,
        titleBox.left - box.left,
        titleBox.top - box.top,
        titleBox.width,
        titleBox.height
      );
      return;
    } catch {
      // Fall through to fillText if the node rasterizer fails.
    }
  }
  ctx.fillStyle = "#292929";
  ctx.font = `400 ${BADGE_SHARE_TITLE_SIZE}px "STK Bureau Sans", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(headline, BADGE_SHARE_TITLE_X, box.height / 2, 520);
}

export async function captureHeroShare(
  hero: HTMLElement,
  headline: string
): Promise<HTMLCanvasElement> {
  await waitTwoFrames();
  const rect = hero.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  const ctx = canvas.getContext("2d");
  if (!ctx || rect.width < 1 || rect.height < 1) return canvas;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawShareGrid(ctx, rect.width, rect.height);
  for (const source of hero.querySelectorAll("canvas")) {
    stampShareCanvas(ctx, source, rect);
  }
  await paintShareTitle(ctx, hero, rect, headline, pixelRatio);
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
