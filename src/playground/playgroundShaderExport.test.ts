import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYGROUND_SOURCE_TRANSFORM } from "./playgroundSourceTransform";
import { PlaygroundShaderRenderer } from "./playgroundShaderSource";
import { sampleShaderPlaygroundFrame } from "./samplePlaygroundFrame";

function checksum(image: ImageData): number {
  let sum = 0;
  for (let i = 0; i < image.data.length; i += 16) {
    sum = (sum + image.data[i]! + image.data[i + 1]! + image.data[i + 2]!) | 0;
  }
  return sum;
}

function canUseWebGL2(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

describe("playground shader export sampling", () => {
  it.skipIf(!canUseWebGL2())("renders different pixels when texture zoom changes under stretch fit", () => {
    const renderer = new PlaygroundShaderRenderer();
    const compile = renderer.setSource(
      "void mainImage(out vec4 O, vec2 I) { O = vec4(fract(I.x/iResolution.x), fract(I.y/iResolution.y), 0.5, 1.0); }",
    );
    expect(compile.ok).toBe(true);

    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    expect(sampleCtx).toBeTruthy();

    const width = 160;
    const height = 90;
    const time = 0;

    const zoomedOut = sampleShaderPlaygroundFrame(
      renderer,
      width,
      height,
      sampleCanvas,
      sampleCtx!,
      { ...DEFAULT_PLAYGROUND_SOURCE_TRANSFORM, zoom: 1 },
      time,
    );
    const zoomedIn = sampleShaderPlaygroundFrame(
      renderer,
      width,
      height,
      sampleCanvas,
      sampleCtx!,
      { ...DEFAULT_PLAYGROUND_SOURCE_TRANSFORM, zoom: 3 },
      time,
    );

    expect(zoomedOut).toBeTruthy();
    expect(zoomedIn).toBeTruthy();
    expect(checksum(zoomedOut!)).not.toBe(checksum(zoomedIn!));

    let opaquePixels = 0;
    for (let i = 3; i < zoomedOut!.data.length; i += 64) {
      if (zoomedOut!.data[i] === 255) {
        opaquePixels += 1;
      }
    }
    expect(opaquePixels).toBeGreaterThan(zoomedOut!.data.length / 64 / 2);
  });
});
