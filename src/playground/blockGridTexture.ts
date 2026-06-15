import { BufferImageSource, Texture } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import type { GridCellRegion } from "./playgroundGridDirty";
import { encodeStripeIndex, STRIPE_CELL_SIZE } from "./stripeGridConstants";

function createBlockMapTexture(buffer: Uint8Array, cols: number, rows: number): Texture {
  return new Texture({
    source: new BufferImageSource({
      resource: buffer,
      width: Math.max(1, cols),
      height: Math.max(1, rows),
      // Index/luma/coverage are data, not color: keep alpha straight so the index byte is
      // never premultiplied by per-cell coverage. Nearest: stop linear bleed between cells.
      alphaMode: "no-premultiply-alpha",
      scaleMode: "nearest",
    }),
  });
}

export class BlockGridTexture {
  private _cols: number;
  private _rows: number;

  // Block map carries DATA — R = stripe index, G = bucketing-space luma, B = index,
  // A = color coverage — not color. Canvas-element uploads pass through the browser image
  // pipeline (the display-p3 `unpackColorSpace` conversion configured in playgroundColorSpace.ts),
  // which mixes channels for non-grayscale texels and corrupts the index/luma bytes (this map
  // stopped being grayscale once G started carrying luma). Upload from a raw byte buffer instead
  // — spec-guaranteed verbatim — exactly like CursorTrailOverlay's data textures.
  texture: Texture;
  private indexBuffer: Uint8Array;

  // Cell colors ARE color: keep the canvas path so display-p3 conversion renders sampled
  // source colors faithfully on the wide-gamut canvas.
  readonly colorTexture: Texture;
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

    this.indexBuffer = new Uint8Array(this._cols * this._rows * 4);
    this.texture = createBlockMapTexture(this.indexBuffer, this._cols, this._rows);

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

    this.indexBuffer = new Uint8Array(nextCols * nextRows * 4);
    this.texture.destroy(true);
    this.texture = createBlockMapTexture(this.indexBuffer, nextCols, nextRows);

    this.colorCanvas.width = nextCols;
    this.colorCanvas.height = nextRows;
    this.colorImageData = this.colorCtx.createImageData(nextCols, nextRows);
    this.colorTexture.source.update();
    return true;
  }

  private writeCell(grid: BlockGrid, col: number, row: number): void {
    const i = row * grid.cols + col;
    const destRow = grid.rows - 1 - row;
    const destIndex = destRow * grid.cols + col;
    const encoded = encodeStripeIndex(grid.indices[i] ?? 0);
    const offset = destIndex * 4;
    const out = this.indexBuffer;
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

    this.texture.source.update();
    this.colorCtx.putImageData(this.colorImageData, 0, 0);
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

    this.texture.source.update();
    this.colorCtx.putImageData(this.colorImageData, 0, 0);
    this.colorTexture.source.update();
  }

  destroy() {
    this.texture.destroy(true);
    this.colorTexture.destroy(true);
  }
}
