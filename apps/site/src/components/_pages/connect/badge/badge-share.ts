import { toCanvas } from "html-to-image";

export const BADGE_SHARE_SURFACE = "#ffffff";

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

export async function captureHeroShare(
  hero: HTMLElement
): Promise<HTMLCanvasElement> {
  await waitTwoFrames();
  const rect = hero.getBoundingClientRect();
  const canvas = await toCanvas(hero, {
    backgroundColor: BADGE_SHARE_SURFACE,
    cacheBust: true,
    filter: keepShareNode,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });
  const ctx = canvas.getContext("2d");
  if (!ctx || rect.width < 1 || rect.height < 1) return canvas;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  for (const source of hero.querySelectorAll("canvas")) {
    if (!("shareStamp" in source.dataset)) continue;
    if (source.width < 2 || source.height < 2) continue;
    const box = source.getBoundingClientRect();
    ctx.drawImage(
      source,
      (box.left - rect.left) * scaleX,
      (box.top - rect.top) * scaleY,
      box.width * scaleX,
      box.height * scaleY
    );
  }
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
