import { folder } from "leva";
import type {
  RainControlSettings,
  RainStripeControl,
} from "../hero/rain-control-settings";
import { loadControlDrawerOpen } from "./drawerState";
import { shaderCodePlugin } from "./shaderCodePlugin";
import type { EditableStripe } from "./stripeAdapter";
import {
  stripeColorsTablePlugin,
  stripeSyncKey,
} from "./stripeColorsTablePlugin";

/**
 * The rain surface of the lab's Leva panel bound to the hero rain layer: gaps,
 * grid geometry, stream wave, the stripe palette table, tone, color mapping,
 * camera, background FX — plus the corridor texture source and the hero's fps
 * cap, which the lab drives elsewhere (transport / no cap).
 */

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
  "exclusion",
];

const optionsFrom = (values: string[]) =>
  Object.fromEntries(
    values.map((value) => [
      value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value,
    ])
  );

const drawerFolder = (
  id: string,
  schema: Parameters<typeof folder>[0],
  defaultOpen = false
) => folder(schema, { collapsed: !loadControlDrawerOpen(id, defaultOpen) });

const num = (
  value: number,
  label: string,
  min: number,
  max: number,
  step: number
) => ({ value, label, min, max, step });

export const toEditableRainStripes = (
  stripes: RainStripeControl[]
): EditableStripe[] =>
  stripes.map((stripe) => ({
    id: stripe.id,
    hex: stripe.color,
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

export function buildRainLevaSchema(values: RainControlSettings) {
  return {
    Rain: drawerFolder(
      "Rain",
      {
        rainGapsEnabled: { value: values.gapsEnabled, label: "Rain gaps" },
        rainGapsCoverage: num(values.gapsCoverage, "Gap coverage", 0, 1, 0.01),
        rainGapsSpeed: num(values.gapsSpeed, "Gap speed", 0, 10, 0.05),
        rainMaxFps: num(values.maxFps, "Max FPS (0 = off)", 0, 120, 1),
        rainTopFadeOffsetPct: num(
          values.topFadeOffsetPct,
          "Fade offset %",
          0,
          100,
          1
        ),
        rainTopFadePct: num(values.topFadePct, "Fade height %", 0, 100, 1),
      },
      true
    ),

    "Grid geometry": drawerFolder(
      "Rain Grid geometry",
      {
        rainGridCellWidth: num(values.gridCellWidth, "Cell width", 1, 200, 1),
        rainGridCellHeight: num(
          values.gridCellHeight,
          "Cell height",
          1,
          200,
          1
        ),
        rainGridGapX: num(values.gridGapX, "Horizontal gap", 0, 60, 0.25),
        rainGridGapY: num(values.gridGapY, "Vertical gap", 0, 60, 0.25),
        rainGridCornerRadius: num(
          values.gridCornerRadius,
          "Corner radius",
          0,
          16,
          0.25
        ),
        rainGridOrientation: {
          value: values.gridOrientation,
          label: "Orientation",
          options: { Vertical: "vertical", Horizontal: "horizontal" },
        },
        rainGridRotationMode: {
          value: values.gridRotationMode,
          label: "Rotation mode",
          options: { Cell: "cell", Overlap: "overlap" },
        },
        rainGridAngle: num(values.gridAngle, "Grid angle", -180, 180, 1),
        rainGridOverlap: num(values.gridOverlap, "Stripe overlap", 0, 4, 0.01),
      },
      true
    ),

    "Stream wave": drawerFolder("Rain Stream wave", {
      rainWaveEnabled: { value: values.waveEnabled, label: "Stream wave" },
      rainWaveSqueeze: num(values.waveSqueeze, "Squeeze", 0, 1, 0.01),
      rainWaveWavelengthCells: num(
        values.waveWavelengthCells,
        "Wavelength (cells)",
        1,
        60,
        1
      ),
      rainWaveSpeed: num(values.waveSpeed, "Wave speed", -20, 20, 0.1),
      rainWavePhaseDeg: num(values.wavePhaseDeg, "Phase", -360, 360, 1),
    }),

    "Stripe palette": drawerFolder(
      "Rain Stripe palette",
      {
        rainStripesEnabled: {
          value: values.stripesEnabled,
          label: "Stripes enabled",
        },
        rainFieldScale: num(values.fieldScale, "Field scale", 0.05, 2, 0.01),
        // The table's rows and edit handlers come from `stripeColorsTableRuntime`;
        // the Leva value is only a sync key that changes when the palette does.
        rainStripeColorsTable: stripeColorsTablePlugin({
          value: stripeSyncKey(toEditableRainStripes(values.stripes)),
        }),
      },
      true
    ),

    Tone: drawerFolder("Rain Tone", {
      rainBrightness: num(values.brightness, "Brightness", -1, 1, 0.01),
      rainExposure: num(values.exposure, "Exposure", -2, 2, 0.01),
      rainContrast: num(values.contrast, "Contrast", 0, 3, 0.01),
      rainBlackPoint: num(values.blackPoint, "Black point", 0, 1, 0.01),
      rainWhitePoint: num(values.whitePoint, "White point", 0, 1, 0.01),
      rainGamma: num(values.gamma, "Gamma", 0.1, 4, 0.01),
      rainInvert: { value: values.invert, label: "Invert" },
    }),

    "Color mapping": drawerFolder("Rain Color mapping", {
      rainColorMode: {
        value: values.colorMode,
        label: "Color source",
        options: { Luminance: "luminance", "Source colors": "colors" },
      },
      rainStripeBlendMode: {
        value: values.stripeBlendMode,
        label: "Stripe blend",
        options: optionsFrom(BLEND_MODES),
      },
    }),

    Camera: drawerFolder("Rain Camera", {
      rainFit: {
        value: values.fit,
        label: "Fit",
        options: {
          Width: "width",
          Height: "height",
          Cover: "cover",
          Contain: "contain",
          Stretch: "stretch",
        },
      },
      rainZoom: num(values.zoom, "Zoom", 0.1, 8, 0.01),
      rainPanX: num(values.panX, "Pan X", -1, 1, 0.01),
      rainPanY: num(values.panY, "Pan Y", -1, 1, 0.01),
    }),

    "Background FX": drawerFolder("Rain Background FX", {
      rainStarsEnabled: { value: values.starsEnabled, label: "Stars" },
      rainStarsDensity: num(values.starsDensity, "Star density", 0, 60, 1),
      rainStarsSizePx: num(values.starsSizePx, "Star size", 1, 24, 1),
      rainMeteorsEnabled: { value: values.meteorsEnabled, label: "Meteors" },
      rainMeteorsRatePerSec: num(
        values.meteorsRatePerSec,
        "Meteor rate /s",
        0,
        10,
        0.02
      ),
      rainMeteorsMaxActive: num(
        values.meteorsMaxActive,
        "Max meteors",
        0,
        64,
        1
      ),
      rainFlamesEnabled: { value: values.flamesEnabled, label: "Flames" },
      rainFlamesMaxActive: num(values.flamesMaxActive, "Max flames", 0, 80, 1),
    }),

    "Texture source": drawerFolder("Rain Texture source", {
      rainSourceSpeed: num(values.sourceSpeed, "Time speed", 0, 4, 0.05),
      rainSourceWidth: num(values.sourceWidth, "Source width", 256, 2048, 64),
      rainSourceHeight: num(
        values.sourceHeight,
        "Source height",
        256,
        2048,
        64
      ),
      rainSourceGlsl: shaderCodePlugin({ value: values.sourceGlsl }),
    }),
  };
}

/**
 * Flat Leva values → the rain settings record. `stripes` is not a Leva value;
 * the palette table edits it through the runtime handlers, so the current list
 * is carried over from `fallback`.
 */
export function rainSettingsFromLevaValues(
  values: Record<string, unknown>,
  fallback: RainControlSettings
): RainControlSettings {
  const pick = <T>(key: string, current: T): T =>
    key in values ? (values[key] as T) : current;

  return {
    ...fallback,
    gapsEnabled: pick("rainGapsEnabled", fallback.gapsEnabled),
    gapsCoverage: pick("rainGapsCoverage", fallback.gapsCoverage),
    gapsSpeed: pick("rainGapsSpeed", fallback.gapsSpeed),
    maxFps: pick("rainMaxFps", fallback.maxFps),
    gridCellWidth: pick("rainGridCellWidth", fallback.gridCellWidth),
    gridCellHeight: pick("rainGridCellHeight", fallback.gridCellHeight),
    gridGapX: pick("rainGridGapX", fallback.gridGapX),
    gridGapY: pick("rainGridGapY", fallback.gridGapY),
    gridCornerRadius: pick("rainGridCornerRadius", fallback.gridCornerRadius),
    gridOrientation: pick("rainGridOrientation", fallback.gridOrientation),
    gridRotationMode: pick("rainGridRotationMode", fallback.gridRotationMode),
    gridAngle: pick("rainGridAngle", fallback.gridAngle),
    gridOverlap: pick("rainGridOverlap", fallback.gridOverlap),
    waveEnabled: pick("rainWaveEnabled", fallback.waveEnabled),
    waveSqueeze: pick("rainWaveSqueeze", fallback.waveSqueeze),
    waveWavelengthCells: pick(
      "rainWaveWavelengthCells",
      fallback.waveWavelengthCells
    ),
    waveSpeed: pick("rainWaveSpeed", fallback.waveSpeed),
    wavePhaseDeg: pick("rainWavePhaseDeg", fallback.wavePhaseDeg),
    stripesEnabled: pick("rainStripesEnabled", fallback.stripesEnabled),
    fieldScale: pick("rainFieldScale", fallback.fieldScale),
    brightness: pick("rainBrightness", fallback.brightness),
    exposure: pick("rainExposure", fallback.exposure),
    contrast: pick("rainContrast", fallback.contrast),
    blackPoint: pick("rainBlackPoint", fallback.blackPoint),
    whitePoint: pick("rainWhitePoint", fallback.whitePoint),
    gamma: pick("rainGamma", fallback.gamma),
    invert: pick("rainInvert", fallback.invert),
    colorMode: pick("rainColorMode", fallback.colorMode),
    stripeBlendMode: pick("rainStripeBlendMode", fallback.stripeBlendMode),
    fit: pick("rainFit", fallback.fit),
    zoom: pick("rainZoom", fallback.zoom),
    panX: pick("rainPanX", fallback.panX),
    panY: pick("rainPanY", fallback.panY),
    starsEnabled: pick("rainStarsEnabled", fallback.starsEnabled),
    starsDensity: pick("rainStarsDensity", fallback.starsDensity),
    starsSizePx: pick("rainStarsSizePx", fallback.starsSizePx),
    meteorsEnabled: pick("rainMeteorsEnabled", fallback.meteorsEnabled),
    meteorsRatePerSec: pick(
      "rainMeteorsRatePerSec",
      fallback.meteorsRatePerSec
    ),
    meteorsMaxActive: pick("rainMeteorsMaxActive", fallback.meteorsMaxActive),
    flamesEnabled: pick("rainFlamesEnabled", fallback.flamesEnabled),
    flamesMaxActive: pick("rainFlamesMaxActive", fallback.flamesMaxActive),
    sourceSpeed: pick("rainSourceSpeed", fallback.sourceSpeed),
    sourceWidth: pick("rainSourceWidth", fallback.sourceWidth),
    sourceHeight: pick("rainSourceHeight", fallback.sourceHeight),
    sourceGlsl: pick("rainSourceGlsl", fallback.sourceGlsl),
    topFadePct: pick("rainTopFadePct", fallback.topFadePct),
    topFadeOffsetPct: pick("rainTopFadeOffsetPct", fallback.topFadeOffsetPct),
  };
}
