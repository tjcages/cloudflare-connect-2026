import { Texture } from "pixi.js";

const LUT_WIDTH = 256;

/** 256×1 luminance-byte → stripe-index lookup for GPU flame bucketing. */
export class StripeIndexLutTexture {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  texture: Texture;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = LUT_WIDTH;
    this.canvas.height = 1;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable for stripe index LUT texture.");
    }
    this.ctx = ctx;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "nearest";
  }

  update(lut: Uint8Array): void {
    const image = this.ctx.createImageData(LUT_WIDTH, 1);
    const data = image.data;
    for (let i = 0; i < LUT_WIDTH; i++) {
      const value = lut[i] ?? 0;
      const offset = i * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
    this.ctx.putImageData(image, 0, 0);
    this.texture.source.update();
  }
}
