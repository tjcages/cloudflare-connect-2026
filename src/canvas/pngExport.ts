import { drawDocument } from "./documentRenderer";
import type { ComponentInstance, GeneratedGrid } from "../grid/types";

type ExportDocumentPngOptions = {
  grid: GeneratedGrid;
  instances: ComponentInstance[];
  scale: 1 | 2;
};

export const createDocumentPngBlob = ({ grid, instances, scale }: ExportDocumentPngOptions): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = grid.config.logicalWidth * scale;
    canvas.height = grid.config.logicalHeight * scale;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Canvas 2D context is unavailable."));
      return;
    }

    drawDocument(context, { grid, instances, scale });
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG export failed."));
      }
    }, "image/png");
  });

const downloadBlob = (blob: Blob, scale: 1 | 2) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = scale === 2 ? "component-builder@2x.png" : "component-builder.png";
  link.click();
  URL.revokeObjectURL(url);
};

export const copyDocumentPng = async (options: ExportDocumentPngOptions) => {
  const blob = await createDocumentPngBlob(options);
  const ClipboardItemConstructor = window.ClipboardItem;

  if (navigator.clipboard?.write && ClipboardItemConstructor) {
    await navigator.clipboard.write([
      new ClipboardItemConstructor({
        "image/png": blob,
      }),
    ]);
    return;
  }

  downloadBlob(blob, options.scale);
};
