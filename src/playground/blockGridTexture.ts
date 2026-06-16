import { Texture } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import type { GridCellRegion } from "./playgroundGridDirty";
import { decodeStripeIndex, encodeStripeIndex, STRIPE_CELL_SIZE } from "./stripeGridConstants";

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

  update(grid: BlockGrid, options: { includeColors?: boolean } = {}) {
    if (grid.cols !== this._cols || grid.rows !== this._rows) {
      return;
    }
    const includeColors = options.includeColors ?? true;
    const out = this.imageData.data;
    const colorOut = this.colorImageData.data;
    const indices = grid.indices;
    const luma = grid.luma;
    const coverage = grid.colorCoverage;
    const colors = grid.colors;

    for (let row = 0; row < grid.rows; row++) {
      const srcRowOffset = row * grid.cols;
      const destRow = grid.rows - 1 - row;
      const destRowOffset = destRow * grid.cols;
      for (let col = 0; col < grid.cols; col++) {
        const srcIndex = srcRowOffset + col;
        const destIndex = destRowOffset + col;
        const offset = destIndex * 4;
        const encoded = encodeStripeIndex(indices[srcIndex] ?? 0);
        out[offset] = encoded;
        out[offset + 1] = luma?.[srcIndex] ?? 0;
        out[offset + 2] = encoded;
        out[offset + 3] = coverage?.[srcIndex] ?? 255;
        if (!includeColors) {
          continue;
        }
        const colorOffset = srcIndex * 3;
        colorOut[offset] = colors?.[colorOffset] ?? 0;
        colorOut[offset + 1] = colors?.[colorOffset + 1] ?? 0;
        colorOut[offset + 2] = colors?.[colorOffset + 2] ?? 0;
        colorOut[offset + 3] = 255;
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);
    this.texture.source.update();
    if (includeColors) {
      this.colorCtx.putImageData(this.colorImageData, 0, 0);
      this.colorTexture.source.update();
    }
  }

  updateRegion(grid: BlockGrid, region: GridCellRegion, options: { includeColors?: boolean } = {}) {
    if (grid.cols !== this._cols || grid.rows !== this._rows) {
      return;
    }
    const includeColors = options.includeColors ?? true;
    const out = this.imageData.data;
    const colorOut = this.colorImageData.data;
    const indices = grid.indices;
    const luma = grid.luma;
    const coverage = grid.colorCoverage;
    const colors = grid.colors;

    for (let row = region.rowMin; row <= region.rowMax; row++) {
      const srcRowOffset = row * grid.cols;
      const destRow = grid.rows - 1 - row;
      const destRowOffset = destRow * grid.cols;
      for (let col = region.colMin; col <= region.colMax; col++) {
        const srcIndex = srcRowOffset + col;
        const destIndex = destRowOffset + col;
        const offset = destIndex * 4;
        const encoded = encodeStripeIndex(indices[srcIndex] ?? 0);
        out[offset] = encoded;
        out[offset + 1] = luma?.[srcIndex] ?? 0;
        out[offset + 2] = encoded;
        out[offset + 3] = coverage?.[srcIndex] ?? 255;
        if (!includeColors) {
          continue;
        }
        const colorOffset = srcIndex * 3;
        colorOut[offset] = colors?.[colorOffset] ?? 0;
        colorOut[offset + 1] = colors?.[colorOffset + 1] ?? 0;
        colorOut[offset + 2] = colors?.[colorOffset + 2] ?? 0;
        colorOut[offset + 3] = 255;
      }
    }

    const dirtyX = region.colMin;
    const dirtyY = grid.rows - 1 - region.rowMax;
    const dirtyWidth = region.colMax - region.colMin + 1;
    const dirtyHeight = region.rowMax - region.rowMin + 1;
    this.ctx.putImageData(this.imageData, 0, 0, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    this.texture.source.update();
    if (includeColors) {
      this.colorCtx.putImageData(this.colorImageData, 0, 0, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
      this.colorTexture.source.update();
    }
  }

  /** Read back the grid currently uploaded to the GPU block map (reverses the Y flip from update). */
  snapshotGrid(options: { includeColors?: boolean } = {}): BlockGrid {
    const includeColors = options.includeColors ?? true;
    const cells = this._cols * this._rows;
    const indices = new Uint8Array(cells);
    const luma = new Uint8Array(cells);
    const colorCoverage = new Uint8Array(cells);
    const colors = includeColors ? new Uint8Array(cells * 3) : undefined;

    const block = this.imageData.data;
    const colorBlock = this.colorImageData.data;

    for (let row = 0; row < this._rows; row++) {
      const destRow = this._rows - 1 - row;
      const destRowOffset = destRow * this._cols;
      for (let col = 0; col < this._cols; col++) {
        const srcIndex = row * this._cols + col;
        const destIndex = destRowOffset + col;
        const offset = destIndex * 4;
        indices[srcIndex] = decodeStripeIndex(block[offset] ?? 0);
        luma[srcIndex] = block[offset + 1] ?? 0;
        colorCoverage[srcIndex] = block[offset + 3] ?? 255;
        if (includeColors && colors) {
          const colorOffset = srcIndex * 3;
          colors[colorOffset] = colorBlock[offset] ?? 0;
          colors[colorOffset + 1] = colorBlock[offset + 1] ?? 0;
          colors[colorOffset + 2] = colorBlock[offset + 2] ?? 0;
        }
      }
    }

    return {
      cols: this._cols,
      rows: this._rows,
      indices,
      luma,
      colorCoverage,
      ...(colors ? { colors } : {}),
    };
  }

  destroy() {
    this.texture.destroy(true);
    this.colorTexture.destroy(true);
  }
}
