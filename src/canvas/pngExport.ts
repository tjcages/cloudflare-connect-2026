import { useAppStore } from "../store";

const downloadBlob = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "component-builder@2x.png";
  link.click();
  URL.revokeObjectURL(url);
};

export const createDocumentPngBlob = async (): Promise<Blob> => {
  useAppStore.getState().selectInstance(null);

  const app = useAppStore.getState().pixiApp;
  if (!app || !app.renderer) {
    throw new Error("Pixi application is unavailable.");
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  app.renderer.render(app.stage);

  const image = await app.renderer.extract.image({
    target: app.stage,
    format: "png",
    resolution: 2,
    antialias: true,
    clearColor: "#00000000",
  });

  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas 2D context is unavailable."));
      return;
    }

    ctx.drawImage(image as CanvasImageSource, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed."));
      }
    }, "image/png");
  });
};

export const copyDocumentPng = async (): Promise<void> => {
  const blob = await createDocumentPngBlob();

  const ClipboardItemConstructor = window.ClipboardItem;

  if (navigator.clipboard?.write && ClipboardItemConstructor) {
    await navigator.clipboard.write([
      new ClipboardItemConstructor({
        "image/png": blob,
      }),
    ]);

    return;
  }

  downloadBlob(blob);
};
