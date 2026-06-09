import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { resetAppStoreDocumentToDefault } from "../store";

const originalGetContext =
  typeof HTMLCanvasElement !== "undefined" ? HTMLCanvasElement.prototype.getContext : undefined;

class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Silence incomplete Canvas2D in jsdom/happy-dom for tests that touch `getContext("2d")`. */
beforeEach(() => {
  if (typeof ResizeObserver === "undefined") {
    globalThis.ResizeObserver = TestResizeObserver;
  }

  if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.hasPointerCapture = () => false;
  }

  if (typeof HTMLCanvasElement !== "undefined" && originalGetContext) {
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
          fillText: () => {},
          scale: () => {},
          font: "",
          fillStyle: "",
          strokeStyle: "",
          globalCompositeOperation: "source-over",
          createLinearGradient: () =>
            ({
              addColorStop: () => {},
            }) as CanvasGradient,
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) as ImageData,
          createImageData: (width: number, height: number) =>
            ({ data: new Uint8ClampedArray(width * height * 4), width, height }) as ImageData,
          putImageData: () => {},
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
  }

  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
  resetAppStoreDocumentToDefault();
});

afterEach(() => {
  if (typeof HTMLCanvasElement !== "undefined" && originalGetContext) {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
});
