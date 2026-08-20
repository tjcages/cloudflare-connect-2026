export const BADGE_SHARE_SURFACE = "#ffffff";
export const BADGE_SHARE_FILE = "connect-2026-badge.png";
export const BADGE_SHARE_WIDTH = 1200;
export const BADGE_SHARE_HEIGHT = 800;
export const BADGE_SHARE_HEADLINE = "Let’s shape what’s\nnext together";
export const BADGE_SHARE_VENUE = ["Moscone Center", "San Francisco"] as const;
export const BADGE_SHARE_DATE = "October 20, 2026";

export function badgeShareHeadline(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "My Connect 2026 badge";
  return `${trimmed}'s Connect 2026 badge`;
}

export function badgeTweetUrl(headline: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(headline)}`;
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

async function waitForDesktopShareSize(scene: HTMLElement) {
  const slack = 2;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rect = scene.getBoundingClientRect();
    const canvas =
      scene.querySelector<HTMLCanvasElement>("canvas[data-share-stamp]") ??
      scene.querySelector("canvas");
    const canvasW = canvas?.clientWidth ?? 0;
    const canvasH = canvas?.clientHeight ?? 0;
    if (
      rect.width >= BADGE_SHARE_WIDTH - slack &&
      rect.height >= BADGE_SHARE_HEIGHT - slack &&
      canvasW >= BADGE_SHARE_WIDTH - slack &&
      canvasH >= BADGE_SHARE_HEIGHT - slack
    ) {
      window.dispatchEvent(new Event("resize"));
      await waitTwoFrames();
      await waitTwoFrames();
      return;
    }
    await waitTwoFrames();
  }
}

async function withDesktopShareLayout<T>(
  scene: HTMLElement,
  run: () => Promise<T>
): Promise<T> {
  if (window.innerWidth >= 992) return run();

  const spacer = document.createElement("div");
  spacer.dataset.shareCaptureSpacer = "";
  spacer.style.height = `${scene.getBoundingClientRect().height}px`;
  scene.parentElement?.insertBefore(spacer, scene);

  const previousCss = scene.style.cssText;
  scene.dataset.shareCapturing = "";
  scene.style.position = "fixed";
  scene.style.left = "0px";
  scene.style.top = "0px";
  scene.style.width = `${BADGE_SHARE_WIDTH}px`;
  scene.style.height = `${BADGE_SHARE_HEIGHT}px`;
  scene.style.zIndex = "-1";
  scene.style.opacity = "0";
  scene.style.pointerEvents = "none";
  scene.style.maxHeight = "none";
  try {
    await waitForDesktopShareSize(scene);
    return await run();
  } finally {
    delete scene.dataset.shareCapturing;
    scene.style.cssText = previousCss;
    spacer.remove();
  }
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

function backdropCanvases(hero: HTMLElement): HTMLCanvasElement[] {
  const marked = Array.from(
    hero.querySelectorAll<HTMLCanvasElement>("canvas[data-share-backdrop]")
  );
  if (marked.length > 0) return marked;
  return Array.from(
    hero.querySelectorAll<HTMLElement>("[data-share-layer='behind']")
  )
    .map((layer) => layer.querySelector("canvas"))
    .filter((node): node is HTMLCanvasElement => Boolean(node));
}

async function snapshotCanvas(
  source: HTMLCanvasElement
): Promise<HTMLCanvasElement | null> {
  if (source.width < 2 || source.height < 2) return null;
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  try {
    const image = await loadImage(source.toDataURL("image/png"));
    ctx.drawImage(image, 0, 0);
    return copy;
  } catch {
    try {
      ctx.drawImage(source, 0, 0);
      return copy;
    } catch {
      return null;
    }
  }
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
  const rx = Math.max(1, (mask.w / 100) * canvas.width);
  const ry = Math.max(1, (mask.h / 100) * canvas.height);
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

async function waitForBackdrop(hero: HTMLElement) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ready = backdropCanvases(hero).some((node) => {
      if (node.width < 2 || node.height < 2) return false;
      try {
        return node.toDataURL("image/png").length > 800;
      } catch {
        return true;
      }
    });
    if (ready) return;
    await waitTwoFrames();
  }
}

async function stampBackdrop(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const layers = Array.from(
    hero.querySelectorAll<HTMLElement>("[data-share-layer='behind']")
  );
  for (const layer of layers) {
    const source =
      layer.querySelector<HTMLCanvasElement>("canvas[data-share-backdrop]") ??
      layer.querySelector("canvas");
    if (!source) continue;
    const snapshot = await snapshotCanvas(source);
    if (!snapshot) continue;
    const masked = maskBehindCanvas(
      snapshot,
      parseMask(layer.dataset.shareMask) ?? {
        w: 62,
        h: 78,
        x: 62,
        y: 44,
      }
    );
    drawLayer(ctx, masked, layer.getBoundingClientRect(), rect, scaleX, scaleY);
  }
}

function stampLanyard(
  ctx: CanvasRenderingContext2D,
  hero: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const behind = new Set(backdropCanvases(hero));
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
              node.width > 1 && node.height > 1 && !behind.has(node)
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
  scene: HTMLElement,
  rect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  await stampHeroGrid(ctx, scene, rect, scaleX, scaleY);
  await stampBackdrop(ctx, scene, rect, scaleX, scaleY);
  stampLanyard(ctx, scene, rect, scaleX, scaleY);
}

export function wrapShareTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let line = words[0]!;
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index]!;
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  lines.push(line);
  return lines;
}

function paintShareText(
  ctx: CanvasRenderingContext2D,
  node: HTMLElement,
  rect: DOMRect
) {
  const style = getComputedStyle(node);
  const box = node.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const raw = (node.innerText || node.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!raw) return;
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.1 ||
    48;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = style.color || "#f46021";
  ctx.font = style.font || '400 56px "STK Bureau Sans", sans-serif';
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if ("letterSpacing" in ctx && style.letterSpacing !== "normal") {
    ctx.letterSpacing = style.letterSpacing;
  }
  const maxWidth = Math.max(1, box.width);
  let y = box.top - rect.top;
  for (const paragraph of raw.split(/\n+/)) {
    const lines = wrapShareTitle(ctx, paragraph.trim(), maxWidth);
    for (const line of lines) {
      ctx.fillText(line, box.left - rect.left, y, maxWidth);
      y += lineHeight;
    }
  }
  ctx.restore();
}

async function stampShareLogo(
  ctx: CanvasRenderingContext2D,
  copy: HTMLElement,
  rect: DOMRect
) {
  const host = copy.querySelector("[data-share-logo]");
  if (!(host instanceof Element)) return;
  const svg =
    host instanceof SVGSVGElement
      ? host
      : host.querySelector("svg");
  if (!svg) return;
  const box = svg.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    drawLayer(ctx, image, box, rect, 1, 1);
  } catch {
    // Wordmark + headline still export if the cloud SVG blob fails.
  } finally {
    URL.revokeObjectURL(url);
  }
}

function stampShareStamps(
  ctx: CanvasRenderingContext2D,
  copy: HTMLElement,
  rect: DOMRect
) {
  const nodes = copy.querySelectorAll<HTMLElement>("[data-share-stamp]");
  for (const node of nodes) {
    paintShareText(ctx, node, rect);
  }
}

async function stampShareCopy(
  ctx: CanvasRenderingContext2D,
  scene: HTMLElement,
  rect: DOMRect
) {
  const copy = scene.querySelector<HTMLElement>("[data-share-copy]");
  if (!copy) return;
  const box = copy.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  await stampShareLogo(ctx, copy, rect);
  stampShareStamps(ctx, copy, rect);
}

export async function captureHeroShare(
  scene: HTMLElement
): Promise<HTMLCanvasElement> {
  if (document.fonts?.status !== "loaded") {
    try {
      await document.fonts.ready;
    } catch {
      // Stamp with whatever face is already available.
    }
  }
  return withDesktopShareLayout(scene, async () => {
    await waitForBackdrop(scene);
    const rect = scene.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = BADGE_SHARE_SURFACE;
    ctx.fillRect(0, 0, rect.width, rect.height);
    await stampHeroLayers(ctx, scene, rect, 1, 1);
    await stampShareCopy(ctx, scene, rect);
    return canvas;
  });
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
