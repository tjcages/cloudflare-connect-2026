import { effectiveStripes, normalizeEngineConfig, type EngineConfig } from "@necatikcl/stripes-engine";
import type { SharedShaderHandle } from "@necatikcl/stripes-engine/react";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { cellGridToSvg, downloadSvg } from "../../../../../../../apps/lab/src/export/cellGridToSvg";
import { downloadEps, svgToEps } from "../../../../../../../apps/lab/src/export/svgToEps";
import { resolveSvgExportBackground } from "../../../../../../../apps/lab/src/export/svgExportBackground";
import { twizzlerToSvgLayer } from "../../../../../../../apps/lab/src/export/twizzlerToSvg";
import { buildFrameGroups, framesOverlayToSvg } from "../../../../../../../apps/lab/src/framesOverlay";
import type { ConnectHeroRain } from "../hero/rain-control-settings";

const colorHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export async function buildAnimationSvg({
  animationTimeSec,
  canvasHeightPx: requestedCanvasHeightPx,
  canvasWidthPx: requestedCanvasWidthPx,
  handle,
  rain,
  rainCanvas,
  rainEnabled = true,
  settings,
  twizzlerCanvas,
  twizzlerEnabled = true,
}: {
  animationTimeSec: number;
  canvasHeightPx?: number;
  canvasWidthPx?: number;
  handle?: SharedShaderHandle | null;
  rain: ConnectHeroRain;
  rainCanvas?: HTMLCanvasElement | null;
  rainEnabled?: boolean;
  settings: TwizzlerSettings;
  twizzlerCanvas?: HTMLCanvasElement | null;
  twizzlerEnabled?: boolean;
}): Promise<string> {
  const config = normalizeEngineConfig(rain.config as Partial<EngineConfig>);
  if (rainEnabled && !handle) throw new Error("Rain is enabled, but its export handle is unavailable.");
  if (twizzlerEnabled && !twizzlerCanvas) throw new Error("Twizzler is enabled, but its export canvas is unavailable.");

  const readback = rainEnabled
    ? await handle!.readCellGrid()
    : { colors: null, cols: 0, rows: 0, values: new Uint8Array() };
  const sizeCanvas = rainCanvas ?? twizzlerCanvas;
  const canvasWidthPx = Math.max(
    1,
    Math.round(
      (requestedCanvasWidthPx ?? Number.parseFloat(sizeCanvas?.style.width ?? "")) ||
        sizeCanvas?.clientWidth ||
        sizeCanvas?.width ||
        1,
    ),
  );
  const canvasHeightPx = Math.max(
    1,
    Math.round(
      (requestedCanvasHeightPx ?? Number.parseFloat(sizeCanvas?.style.height ?? "")) ||
        sizeCanvas?.clientHeight ||
        sizeCanvas?.height ||
        1,
    ),
  );
  const resolvedStripes = rainEnabled ? effectiveStripes(config) : [];
  const stripes = resolvedStripes.map((stripe) => ({
    hex: colorHex(stripe.color),
    opacity: stripe.opacity,
    startFrom: stripe.startFrom,
    width: stripe.width,
  }));
  const exportBackground = resolveSvgExportBackground({
    backgroundColorHex: colorHex(rain.exportBackground.color),
    backgroundGradient: rain.exportBackground.gradient.enabled
      ? {
          direction: rain.exportBackground.gradient.direction,
          stopCount: rain.exportBackground.gradient.stopCount,
          stops: rain.exportBackground.gradient.stops.map(colorHex),
        }
      : undefined,
    backgroundGradientEnabled: rain.exportBackground.gradient.enabled,
    backgroundTransparent: rain.exportBackground.transparent,
  });
  const twizzlerSvgLayer =
    twizzlerEnabled && twizzlerCanvas
      ? twizzlerToSvgLayer(
          Math.max(1, twizzlerCanvas.width),
          Math.max(1, twizzlerCanvas.height),
          canvasWidthPx,
          canvasHeightPx,
          animationTimeSec,
          {
            ...settings,
            backgroundColor: colorHex(rain.exportBackground.color),
            speed: 1,
          },
        )
      : undefined;
  const framesSvgLayer =
    rainEnabled && config.frames.enabled
      ? framesOverlayToSvg(
          buildFrameGroups(
            readback,
            config.frames.luminanceThreshold,
            config.frames.groupDistanceCells,
            resolvedStripes,
            config.frames.highlightedStripeCount,
          ),
          config,
          canvasWidthPx,
          canvasHeightPx,
          performance.now() / 1000,
        )
      : undefined;

  return cellGridToSvg(readback, stripes, {
    angleDeg: config.grid.angleDeg,
    backgroundGradient: exportBackground.backgroundGradient,
    backgroundHex: exportBackground.backgroundHex,
    backgroundImageHrefs: [],
    backgroundSvgLayer: twizzlerSvgLayer,
    blendMode: config.colors.stripeBlendMode,
    canvasHeightPx,
    canvasWidthPx,
    cellHeightPx: config.grid.cellHeight,
    cellWidthPx: config.grid.cellWidth,
    framesSvgLayer,
    gapX: config.grid.gapX,
    gapY: config.grid.gapY,
    gradient: config.colors.gradient.enabled
      ? {
          direction: config.colors.gradient.direction,
          hueDriftDeg: config.colors.gradient.hueDriftDeg,
          saturationBoost: config.colors.gradient.saturationBoost,
          stopCount: config.colors.gradient.stopCount,
          stops: config.colors.gradient.stops.map(colorHex),
        }
      : undefined,
    gridLines: config.gridLines,
    letters: config.letters,
    orientation: config.grid.orientation,
    overlapAmount: config.grid.overlapAmount,
    rotationMode: config.grid.rotationMode,
    streamGapWave: config.grid.streamGapWave,
    stripeBorder: config.stripeBorder,
    stripeDots: config.stripeDots,
    useCellColors: rainEnabled && readback.colors !== null,
    widthSparkle: config.sparkle.width,
  });
}

export function exportAnimationSvg(svg: string): void {
  downloadSvg(svg, "cloudflare-connect-animation.svg");
}

export function exportAnimationEps(svg: string): void {
  downloadEps(svgToEps(svg), "cloudflare-connect-animation.eps");
}
