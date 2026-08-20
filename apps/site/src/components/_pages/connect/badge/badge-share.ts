import { toCanvas } from "html-to-image";

export const BADGE_SHARE_SURFACE = "#ffffff";
export const BADGE_SHARE_FILE = "connect-2026-badge.png";

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
  if (node.nodeName === "CANVAS") return false;
  return !node.hasAttribute("data-share-hide");
}

function waitTwoFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(
      () => reject(new Error("Share capture timed out")),
      ms
    );
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(id);
        reject(error);
      }
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load share layer"));
    image.src = url;
  });
}

function parseMask(value: string | undefined): {
  w: number;
  h: number;
  x: number;
  y: number;
} | null {
  if (!value) return null;
  const parts = value.split(/\s+/).map(Number);
  const w = parts[0];
  const h = parts[1];
  const x = parts[2];
  const y = parts[3];
  if (
    parts.length < 4 ||
    w === undefined ||
    h === undefined ||
    x === undefined ||
    y === undefined ||
    [w, h, x, y].some((part) => !Number.isFinite(part))
  ) {
    return null;
  }
  return { w, h, x, y };
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: DOMRect,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  ctx.drawImage(
    source,
    (box.left - rect.left) * scaleX,
    (box.top - rect.top) * scaleY,
    box.width * scaleX,
    box.height * scaleY
  );
}

function maskBehindCanvas(
  source: HTMLCanvasElement,
  mask: { w: number; h: number; x: number; y: number }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, source.width);
  canvas.height = Math.max(1, source.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const gx = (mask.x / 100) * canvas.width;
  const gy = (mask.y / 100) * canvas.height;
  const rx = Math.max(1, (mask.w / 100) * canvas.width * 0.5);
  const ry = Math.max(1, (mask.h / 100) * canvas.height * 0.5);
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(gx, gy);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0.16, "#000");
  gradient.addColorStop(0.72, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(-gx / rx, -gy / ry, canvas.width / rx, canvas.height / ry);
  ctx.restore();
  return canvas;
}

function stampShareCanvases(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const behind = Array.from(
    hero.querySelectorAll<HTMLElement>("[data-share-layer='behind']")
  );
  const behindCanvases = new Set<HTMLCanvasElement>();
  for (const layer of behind) {
    const source = layer.querySelector("canvas");
    if (!source || source.width < 2 || source.height < 2) continue;
    behindCanvases.add(source);
    const masked = maskBehindCanvas(
      source,
      parseMask(layer.dataset.shareMask) ?? {
        w: 62,
        h: 78,
        x: 62,
        y: 44,
      }
    );
    drawLayer(ctx, masked, source.getBoundingClientRect(), rect, scaleX, scaleY);
  }

  const nodes = Array.from(hero.querySelectorAll("canvas"));
  const stamped = nodes.filter(
    (node) => "shareStamp" in node.dataset && node.width > 1 && node.height > 1
  );
  const fallback =
    stamped.length > 0
      ? stamped
      : nodes
          .filter(
            (node) =>
              node.width > 1 &&
              node.height > 1 &&
              !behindCanvases.has(node)
          )
          .sort((a, b) => b.width * b.height - a.width * a.height)
          .slice(0, 1);
  for (const source of fallback) {
    drawLayer(ctx, source, source.getBoundingClientRect(), rect, scaleX, scaleY);
  }
}

async function stampHeroGrid(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const svg = hero.querySelector<SVGSVGElement>("[data-share-grid]");
  if (!svg) return;
  const box = svg.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const style = getComputedStyle(svg);
  const fill =
    style.getPropertyValue("--color-background-surface").trim() || "#f8f8f8";
  const stroke = style.color || "#e6e6e6";
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.querySelector("rect")?.setAttribute("fill", fill);
  clone.querySelector("path")?.setAttribute("stroke", stroke);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    drawLayer(ctx, image, box, rect, scaleX, scaleY);
  } catch {
    // Title + rain + lanyard still export if the SVG blob fails.
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function stampHeroLayers(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  await stampHeroGrid(ctx, hero, rect, scaleX, scaleY);
  stampShareCanvases(ctx, hero, rect, scaleX, scaleY);
}

async function captureHeroShareFallback(
  hero: HTMLElement
): Promise<HTMLCanvasElement> {
  const rect = hero.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = BADGE_SHARE_SURFACE;
  ctx.fillRect(0, 0, rect.width, rect.height);
  await stampHeroLayers(ctx, hero, rect, 1, 1);
  const title = hero.querySelector("h1");
  if (title) {
    const style = getComputedStyle(title);
    const box = title.getBoundingClientRect();
    ctx.fillStyle = style.color || "#292929";
    ctx.font = style.font || '400 44px "STK Bureau Sans", sans-serif';
    ctx.textBaseline = "top";
    ctx.fillText(
      title.textContent?.trim() || "Your Connect 2026 badge",
      box.left - rect.left,
      box.top - rect.top,
      Math.max(1, box.width)
    );
  }
  return canvas;
}

export async function captureHeroShare(
  hero: HTMLElement
): Promise<HTMLCanvasElement> {
  await waitTwoFrames();
  const rect = hero.getBoundingClientRect();
  try {
    const canvas = await withTimeout(
      toCanvas(hero, {
        backgroundColor: BADGE_SHARE_SURFACE,
        cacheBust: true,
        filter: keepShareNode,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      }),
      4000
    );
    const ctx = canvas.getContext("2d");
    if (!ctx || rect.width < 1 || rect.height < 1) {
      return captureHeroShareFallback(hero);
    }
    await stampHeroLayers(
      ctx,
      hero,
      rect,
      canvas.width / rect.width,
      canvas.height / rect.height
    );
    return canvas;
  } catch {
    return captureHeroShareFallback(hero);
  }
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
  const file = new File([blob], BADGE_SHARE_FILE, { type: "image/png" });
  const url = URL.createObjectURL(file);
  let copied = false;
  try {
    await withTimeout(
      navigator.clipboard.write([new ClipboardItem({ "image/png": file })]),
      1500
    );
    copied = true;
  } catch {
    try {
      await withTimeout(
        navigator.clipboard.write([
          new ClipboardItem({ "image/png": Promise.resolve(blob) }),
        ]),
        1500
      );
      copied = true;
    } catch {
      // Preview still lets someone save the image.
    }
  }
  return { url, copied };
}
