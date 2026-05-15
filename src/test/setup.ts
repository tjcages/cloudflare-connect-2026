import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { resetAppStoreDocumentToDefault } from "../store";

const originalGetContext = HTMLCanvasElement.prototype.getContext;

/** Silence jsdom's incomplete Canvas2D implementation for tests that touch `getContext("2d")`. */
beforeEach(() => {
  const patchedGetContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ..._rest: unknown[]
  ): RenderingContext | null {
    if (contextId === "2d") {
      return {
        canvas: this,
        drawImage: () => {},
        fillRect: () => {},
        clearRect: () => {},
        measureText: () =>
          ({
            width: 120,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 2,
          }) as TextMetrics,
        font: "",
        fillStyle: "",
        strokeStyle: "",
        getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) as ImageData,
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  };

  HTMLCanvasElement.prototype.getContext = patchedGetContext as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback | null,
    type?: string,
    ..._quality: unknown[]
  ): void {
    queueMicrotask(() => {
      callback?.(new Blob([new Uint8Array([137, 80, 78, 71])], { type: type ?? "image/png" }));
    });
  };

  localStorage.clear();
  resetAppStoreDocumentToDefault();
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});
