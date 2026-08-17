import type { Application } from "pixi.js";

let active: boolean | null = null;

const supportsDisplayP3ImageData = () => {
  try {
    return (
      new ImageData(1, 1, { colorSpace: "display-p3" }).colorSpace ===
      "display-p3"
    );
  } catch {
    return false;
  }
};

export function isDisplayP3Active(): boolean {
  if (active !== null) return active;

  active =
    typeof window !== "undefined" &&
    typeof CSS !== "undefined" &&
    window.matchMedia("(color-gamut: p3)").matches &&
    CSS.supports("color", "color(display-p3 1 0 0)") &&
    typeof WebGL2RenderingContext !== "undefined" &&
    "drawingBufferColorSpace" in WebGL2RenderingContext.prototype &&
    supportsDisplayP3ImageData();

  return active;
}

export const enableDisplayP3IfSupported = (app: Application) => {
  if (!isDisplayP3Active()) return;

  const gl = (app.renderer as { gl?: WebGL2RenderingContext }).gl;

  if (!gl) return;
  if (!("drawingBufferColorSpace" in gl)) return;

  const apply = () => {
    try {
      gl.drawingBufferColorSpace = "display-p3";
    } catch {
      return;
    }
  };

  apply();

  const canvas = gl.canvas;
  canvas.addEventListener("webglcontextrestored", apply);

  return () => canvas.removeEventListener("webglcontextrestored", apply);
};
