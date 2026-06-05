import { Texture } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import { encodeStripeIndex, STRIPE_CELL_SIZE } from "./stripeGridConstants";

export class BlockGridTexture {
  private _cols: number;
  private _rows: number;

  readonly texture: Texture;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor(
    displayWidth: number,
    displayHeight: number,
    cellWidth: number = STRIPE_CELL_SIZE,
    cellHeight: number = STRIPE_CELL_SIZE,
  ) {
    this._cols = Math.ceil(displayWidth / Math.max(1, cellWidth));
    this._rows = Math.ceil(displayHeight / Math.max(1, cellHeight));
    this.canvas = document.createElement("canvas");
    this.canvas.width = this._cols;
    this.canvas.height = this._rows;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable for block grid texture.");
    }
    this.ctx = ctx;
    this.imageData = ctx.createImageData(this._cols, this._rows);
    this.texture = Texture.from(this.canvas);
    // Nearest: stop linear bleed between band cells.
    this.texture.source.scaleMode = "nearest";
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  /** Returns true when grid dimensions changed. */
  resize(displayWidth: number, displayHeight: number, cellWidth: number, cellHeight: number): boolean {
    const nextCols = Math.ceil(displayWidth / Math.max(1, cellWidth));
    const nextRows = Math.ceil(displayHeight / Math.max(1, cellHeight));
    if (nextCols === this._cols && nextRows === this._rows) {
      return false;
    }

    this._cols = nextCols;
    this._rows = nextRows;
    this.canvas.width = nextCols;
    this.canvas.height = nextRows;
    this.imageData = this.ctx.createImageData(nextCols, nextRows);
    this.texture.source.update();
    return true;
  }

  update(grid: BlockGrid) {
    if (grid.cols !== this._cols || grid.rows !== this._rows) {
      return;
    }

    const out = this.imageData.data;
    for (let i = 0; i < grid.indices.length; i++) {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      // Canvas row 0 is top; WebGL samples v=0 from the bottom — store rows flipped.
      const destRow = grid.rows - 1 - row;
      const destIndex = destRow * grid.cols + col;
      const encoded = encodeStripeIndex(grid.indices[i] ?? 0);
      const offset = destIndex * 4;
      out[offset] = encoded;
      out[offset + 1] = encoded;
      out[offset + 2] = encoded;
      out[offset + 3] = 255;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.texture.source.update();
  }

  destroy() {
    this.texture.destroy(true);
  }
}
