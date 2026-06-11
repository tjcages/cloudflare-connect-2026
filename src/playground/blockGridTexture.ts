import { Texture } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import type { GridCellRegion } from "./playgroundGridDirty";
import { encodeStripeIndex, STRIPE_CELL_SIZE } from "./stripeGridConstants";

export class BlockGridTexture {
  private _cols: number;
  private _rows: number;

  readonly texture: Texture;
  readonly colorTexture: Texture;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private readonly colorCanvas: HTMLCanvasElement;
  private readonly colorCtx: CanvasRenderingContext2D;
  private colorImageData: ImageData;

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

    this.colorCanvas = document.createElement("canvas");
    this.colorCanvas.width = this._cols;
    this.colorCanvas.height = this._rows;
    const colorCtx = this.colorCanvas.getContext("2d", { willReadFrequently: true });
    if (!colorCtx) {
      throw new Error("2D canvas context unavailable for block grid color texture.");
    }
    this.colorCtx = colorCtx;
    this.colorImageData = colorCtx.createImageData(this._cols, this._rows);
    this.colorTexture = Texture.from(this.colorCanvas);
    this.colorTexture.source.scaleMode = "nearest";
    // Coverage lives in the block-map alpha channel; keep cell RGB alpha at 255 to avoid
    // premultiply-on-upload darkening sampled colors (see StripePaletteTexture).
    this.colorTexture.source.alphaMode = "no-premultiply-alpha";
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
    this.colorCanvas.width = nextCols;
    this.colorCanvas.height = nextRows;
    this.imageData = this.ctx.createImageData(nextCols, nextRows);
    this.colorImageData = this.colorCtx.createImageData(nextCols, nextRows);
    this.texture.source.update();
    this.colorTexture.source.update();
    return true;
  }

  private writeCell(grid: BlockGrid, col: number, row: number): void {
    const i = row * grid.cols + col;
    const destRow = grid.rows - 1 - row;
    const destIndex = destRow * grid.cols + col;
    const encoded = encodeStripeIndex(grid.indices[i] ?? 0);
    const offset = destIndex * 4;
    const out = this.imageData.data;
    const colorOut = this.colorImageData.data;
    out[offset] = encoded;
    out[offset + 1] = grid.luma?.[i] ?? 0;
    out[offset + 2] = encoded;
    out[offset + 3] = grid.colorCoverage?.[i] ?? 255;

    const colorOffset = i * 3;
    colorOut[offset] = grid.colors?.[colorOffset] ?? 0;
    colorOut[offset + 1] = grid.colors?.[colorOffset + 1] ?? 0;
    colorOut[offset + 2] = grid.colors?.[colorOffset + 2] ?? 0;
    colorOut[offset + 3] = 255;
  }

  update(grid: BlockGrid) {
    if (grid.cols !== this._cols || grid.rows !== this._rows) {
      return;
    }

    for (let i = 0; i < grid.indices.length; i++) {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      this.writeCell(grid, col, row);
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.colorCtx.putImageData(this.colorImageData, 0, 0);
    this.texture.source.update();
    this.colorTexture.source.update();
  }

  updateRegion(grid: BlockGrid, region: GridCellRegion) {
    if (grid.cols !== this._cols || grid.rows !== this._rows) {
      return;
    }

    for (let row = region.rowMin; row <= region.rowMax; row++) {
      for (let col = region.colMin; col <= region.colMax; col++) {
        this.writeCell(grid, col, row);
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.colorCtx.putImageData(this.colorImageData, 0, 0);
    this.texture.source.update();
    this.colorTexture.source.update();
  }

  destroy() {
    this.texture.destroy(true);
    this.colorTexture.destroy(true);
  }
}
