import { bandIndexForValue } from "@necatikcl/stripes-engine";

const ROW_WIDTH_GAP = 1;

type LabStripe = { hex: string; startFrom: number; width: number };

type CellReadback = {
  cols: number;
  rows: number;
  values: Uint8Array;
  colors: Uint8Array | null;
};

function svgStripeClass(band: number): string {
  return `fill-stripe-${band}`;
}

function sameStripeBand(a: number, b: number): boolean {
  if (a < 1 || b < 1) return false;
  return a === b;
}

function cellColorHex(colors: Uint8Array, cellIndex: number): string {
  const offset = cellIndex * 4;
  const r = colors[offset] ?? 0;
  const g = colors[offset + 1] ?? 0;
  const b = colors[offset + 2] ?? 0;
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function cellGridToSvg(
  readback: CellReadback,
  stripes: LabStripe[],
  opts: { cellSizePx: number; useCellColors: boolean },
): string {
  const { cols, rows, values, colors } = readback;
  const { cellSizePx, useCellColors } = opts;

  const sortedStripes = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const engineStripes = stripes.map((s) => ({
    color: parseInt(s.hex.replace(/^#/, ""), 16) || 0,
    startFrom: s.startFrom,
    width: s.width,
  }));

  const bandAt = (svgRow: number, col: number): number => {
    // readPixels is bottom-up while SVG is top-down, so flip the row.
    const rbIndex = (rows - 1 - svgRow) * cols + col;
    return bandIndexForValue((values[rbIndex] ?? 0) / 255, engineStripes);
  };

  const pathsByBand = new Map<number, string[]>();
  const cellColorPaths: string[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const band = bandAt(row, col);
      const stripe = band >= 1 ? sortedStripes[band - 1] : undefined;
      if (band < 1 || !stripe) continue;

      const bandAbove = row > 0 ? bandAt(row - 1, col) : 0;
      const bandBelow = row < rows - 1 ? bandAt(row + 1, col) : 0;
      const chainBreaksAbove = !sameStripeBand(band, bandAbove);
      const chainBreaksBelow = !sameStripeBand(band, bandBelow);

      let bandTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0;
      let bandBottom = cellSizePx - (chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0);
      if (bandBottom - bandTop < cellSizePx) {
        bandTop = 0;
        bandBottom = cellSizePx;
      }

      const rbIndex = (rows - 1 - row) * cols + col;
      const coverageScale = useCellColors && colors ? Math.max((colors[rbIndex * 4 + 3] ?? 255) / 255, 1 / 255) : 1;
      const stripeWidth = Math.max(1, stripe.width * coverageScale);
      const halfW = stripeWidth * 0.5;
      const columnCenter = col * cellSizePx + cellSizePx * 0.5;
      const x = columnCenter - halfW;
      const y = row * cellSizePx + bandTop;
      const rectW = stripeWidth;
      const rectH = bandBottom - bandTop;

      const segment = `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
      if (useCellColors && colors) {
        cellColorPaths.push(`  <path fill="${cellColorHex(colors, rbIndex)}" d="${segment}" />`);
        continue;
      }
      const list = pathsByBand.get(band) ?? [];
      list.push(segment);
      pathsByBand.set(band, list);
    }
  }

  const width = cols * cellSizePx;
  const height = rows * cellSizePx;

  if (useCellColors) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
      cellColorPaths.join("\n"),
      `</svg>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const usedBands = [...pathsByBand.keys()].sort((a, b) => a - b);
  const styleRules = usedBands.map((band) => {
    const stripe = sortedStripes[band - 1];
    return `  .${svgStripeClass(band)} { fill: ${stripe?.hex ?? "#000000"}; }`;
  });
  const styleBlock = usedBands.length > 0 ? ["<style>", ...styleRules, "</style>"].join("\n") : "";
  const pathElements = usedBands
    .map((band) => `  <path class="${svgStripeClass(band)}" d="${(pathsByBand.get(band) ?? []).join(" ")}" />`)
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">`,
    styleBlock,
    pathElements,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function downloadSvg(svg: string, filename = "stripes.svg"): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
