import type { Application } from "pixi.js";

function buildSvgWithEmbeddedImage(dataUrl: string, displayWidth: number, displayHeight: number): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${displayWidth} ${displayHeight}">`,
    `  <image width="${displayWidth}" height="${displayHeight}" href="${dataUrl}" />`,
    `</svg>`,
  ].join("\n");
}

async function dataUrlFromPixiStage(app: Application): Promise<string | null> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  app.renderer.render(app.stage);

  const extracted = await app.renderer.extract.image({
    target: app.stage,
    format: "png",
    resolution: 1,
    antialias: false,
    clearColor: "#00000000",
  });
  const width = extracted.width || 1;
  const height = extracted.height || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(extracted as CanvasImageSource, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

/** Wrap a rendered playground frame in a minimal SVG (WYSIWYG raster export). */
export async function playgroundCanvasToExportSvg(
  canvas: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
  app: Application | null = null,
): Promise<string | null> {
  if (displayWidth <= 0 || displayHeight <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return null;
  }

  try {
    const dataUrl = app ? await dataUrlFromPixiStage(app) : canvas.toDataURL("image/png");
    if (!dataUrl) {
      return null;
    }
    return buildSvgWithEmbeddedImage(dataUrl, displayWidth, displayHeight);
  } catch {
    return null;
  }
}
