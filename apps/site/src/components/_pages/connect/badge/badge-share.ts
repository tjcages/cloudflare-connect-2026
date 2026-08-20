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

function shareCanvases(hero: HTMLElement): HTMLCanvasElement[] {
  const nodes = Array.from(hero.querySelectorAll("canvas"));
  const stamped = nodes.filter(
    (node) => "shareStamp" in node.dataset && node.width > 1 && node.height > 1
  );
  if (stamped.length > 0) return stamped;
  return nodes
    .filter((node) => node.width > 1 && node.height > 1)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 1);
}

function stampShareCanvases(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  for (const source of shareCanvases(hero)) {
    const box = source.getBoundingClientRect();
    ctx.drawImage(
      source,
      (box.left - rect.left) * scaleX,
      (box.top - rect.top) * scaleY,
      box.width * scaleX,
      box.height * scaleY
    );
  }
}

function captureHeroShareFallback(hero: HTMLElement): HTMLCanvasElement {
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
  stampShareCanvases(ctx, hero, rect, 1, 1);
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
    stampShareCanvases(
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
