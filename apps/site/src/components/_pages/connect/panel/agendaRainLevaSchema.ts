import { folder } from "leva";
import type {
  AgendaRainSettings,
  AgendaRainStripeControl,
} from "../agenda/agenda-rain-controls";
import { rainShaderOptions } from "../agenda/rain-shader-library";
import { colorLibraryInputPlugin } from "./colorLibraryInputPlugin";
import { copyConfigFolder } from "./copyConfig";
import { loadControlDrawerOpen } from "./drawerState";
import type { EditableStripe } from "./stripeAdapter";
import {
  stripeColorsTablePlugin,
  stripeSyncKey,
} from "./stripeColorsTablePlugin";

/**
 * The agenda-rain surface of the lab's Leva panel: the "Wave to Full Screen"
 * source framing, the Rain stream knobs, grid geometry, the stripe palette
 * table, tone and background FX — the lab's Graphic Rain controls bound to
 * the site's `AgendaRainSettings`.
 */

const RENDER_MODES = [
  "sharp",
  "abstract",
  "charcoal",
  "pencil",
  "brush",
  "halftone",
  "risograph",
  "stainedGlass",
  "paperCutout",
  "crt",
  "glitch",
  "vhs",
  "amber",
  "gummy",
];

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
  stripes: AgendaRainStripeControl[]
): EditableStripe[] =>
  stripes.map((stripe) => ({
    id: stripe.id,
    hex: stripe.color,
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

export function buildAgendaRainLevaSchema(
  values: AgendaRainSettings,
  onCopyConfig: () => void
) {
  return {
    Rain: drawerFolder(
      "Rain",
      {
        rainEnabled: { value: values.rainEnabled, label: "Rain streams" },
        gapsCoverage: num(values.gapsCoverage, "Gap coverage", 0, 0.95, 0.01),
        gapsSpeed: num(values.gapsSpeed, "Gap speed", 0, 5, 0.01),
        waveEnabled: { value: values.waveEnabled, label: "Stream wave" },
        waveSqueeze: num(values.waveSqueeze, "Wave squeeze", 0, 1, 0.01),
        waveWavelengthCells: num(
          values.waveWavelengthCells,
          "Wave length",
          2,
          64,
          1
        ),
        waveSpeed: num(values.waveSpeed, "Wave speed", -10, 10, 0.01),
        wavePhaseDeg: num(values.wavePhaseDeg, "Wave phase", -180, 180, 1),
      },
      true
    ),

    "Texture source": drawerFolder(
      "Texture source",
      {
        shaderPreset: {
          value: values.shaderPreset,
          label: "Shader",
          options: rainShaderOptions(),
        },
        sourceSpeed: num(values.sourceSpeed, "Source speed", 0, 4, 0.01),
        sourceScale: num(values.sourceScale, "Source resolution", 0.25, 2, 0.05),
        sourceZoom: num(values.sourceZoom, "Source zoom", 0.2, 5, 0.01),
        sourcePanX: num(values.sourcePanX, "Source pan X", -1, 1, 0.01),
        sourcePanY: num(values.sourcePanY, "Source pan Y", -1, 1, 0.01),
        sourceRotateX: num(values.sourceRotateX, "Rotate X", -89, 89, 1),
        sourceRotateY: num(values.sourceRotateY, "Rotate Y", -180, 180, 1),
        sourceRotateZ: num(values.sourceRotateZ, "Rotate Z", -180, 180, 1),
      },
      true
    ),

    "Grid geometry": drawerFolder("Grid geometry", {
      gridCellWidth: num(values.gridCellWidth, "Cell width", 1, 48, 1),
      gridCellHeight: num(values.gridCellHeight, "Cell height", 1, 48, 1),
      gridGapX: num(values.gridGapX, "Horizontal gap", 0, 24, 0.25),
      gridGapY: num(values.gridGapY, "Vertical gap", 0, 24, 0.25),
      gridCornerRadius: num(
        values.gridCornerRadius,
        "Corner radius",
        0,
        16,
        0.25
      ),
      gridOverlap: num(values.gridOverlap, "Stripe overlap", 0, 4, 0.01),
      gridOrientation: {
        value: values.gridOrientation,
        label: "Orientation",
        options: { Vertical: "vertical", Horizontal: "horizontal" },
      },
      gridAngle: num(values.gridAngle, "Grid angle", -180, 180, 1),
    }),

    "Stripe palette": drawerFolder(
      "Stripe palette",
      {
        stripesEnabled: {
          value: values.stripesEnabled,
          label: "Stripes enabled",
        },
        fieldScale: num(values.fieldScale, "Field scale", 0.25, 2, 0.01),
        // The table's rows and edit handlers come from `stripeColorsTableRuntime`;
        // the Leva value is only a sync key that changes when the palette does.
        stripeColorsTable: stripeColorsTablePlugin({
          value: stripeSyncKey(toEditableRainStripes(values.stripes)),
        }),
      },
      true
    ),

    Tone: drawerFolder("Tone", {
      brightness: num(values.brightness, "Brightness", -1, 1, 0.01),
      exposure: num(values.exposure, "Exposure", -2, 2, 0.01),
      contrast: num(values.contrast, "Contrast", 0, 3, 0.01),
      blackPoint: num(values.blackPoint, "Black point", 0, 1, 0.01),
      whitePoint: num(values.whitePoint, "White point", 0, 1, 0.01),
      gamma: num(values.gamma, "Gamma", 0.1, 4, 0.01),
      invert: { value: values.invert, label: "Invert" },
      posterizeLevels: num(
        values.posterizeLevels,
        "Posterize levels",
        0,
        32,
        1
      ),
      thresholdBias: num(values.thresholdBias, "Threshold bias", -1, 1, 0.01),
      noiseAmount: num(values.noiseAmount, "Noise", 0, 1, 0.01),
      blurRadius: num(values.blurRadius, "Blur", 0, 24, 0.25),
      sharpenAmount: num(values.sharpenAmount, "Sharpen", 0, 4, 0.01),
    }),

    "Stripe sparkle": drawerFolder("Stripe sparkle", {
      sparkleWidthEnabled: {
        value: values.sparkleWidthEnabled,
        label: "Width shimmer",
      },
      sparkleWidthCoverage: num(
        values.sparkleWidthCoverage,
        "Width coverage",
        0,
        1,
        0.01
      ),
      sparkleSwing: num(values.sparkleSwing, "Width swing", 0, 12, 0.1),
      sparkleStripeEnabled: {
        value: values.sparkleStripeEnabled,
        label: "Stripe shimmer",
      },
      sparkleStripeCoverage: num(
        values.sparkleStripeCoverage,
        "Stripe coverage",
        0,
        1,
        0.01
      ),
      sparkleBrightness: num(
        values.sparkleBrightness,
        "Maximum brightness",
        0,
        2,
        0.01
      ),
      sparkleSpeed: num(values.sparkleSpeed, "Sparkle speed", 0, 5, 0.01),
      sparkleHueDrift: num(values.sparkleHueDrift, "Hue drift", -180, 180, 1),
      sparkleSaturation: num(
        values.sparkleSaturation,
        "Saturation boost",
        -1,
        2,
        0.01
      ),
      motionEnabled: { value: values.motionEnabled, label: "Stripe motion" },
      motionAmplitude: num(
        values.motionAmplitude,
        "Motion amplitude",
        0,
        64,
        0.1
      ),
      motionStagger: num(values.motionStagger, "Motion stagger", 0, 256, 1),
      motionMaxOffset: num(
        values.motionMaxOffset,
        "Motion max offset",
        0,
        128,
        0.5
      ),
      motionSpeed: num(values.motionSpeed, "Motion speed", 0, 5, 0.01),
      motionDirection: {
        value: values.motionDirection,
        label: "Motion direction",
        options: {
          "Left to right": "leftToRight",
          "Right to left": "rightToLeft",
        },
      },
    }),

    "Stripe detail": drawerFolder("Stripe detail", {
      dotsEnabled: { value: values.dotsEnabled, label: "Stripe dots" },
      dotsDensity: num(values.dotsDensity, "Dot density", 0, 1, 0.01),
      dotsVisibility: num(
        values.dotsVisibility,
        "Random visibility",
        0,
        1,
        0.01
      ),
      dotsSize: num(values.dotsSize, "Dot size", 0.25, 8, 0.05),
      dotsBrightness: num(values.dotsBrightness, "Dot brightness", 0, 2, 0.01),
      dotsHueDrift: num(values.dotsHueDrift, "Dot hue drift", -180, 180, 1),
      dotsSaturation: num(values.dotsSaturation, "Dot saturation", -1, 2, 0.01),
      borderEnabled: { value: values.borderEnabled, label: "Stripe borders" },
      borderMinWidth: num(
        values.borderMinWidth,
        "Border minimum width",
        0,
        24,
        0.25
      ),
      borderDensity: num(values.borderDensity, "Border density", 0, 1, 0.01),
      gridLinesEnabled: { value: values.gridLinesEnabled, label: "Grid lines" },
      gridLinesBrightness: num(
        values.gridLinesBrightness,
        "Grid line brightness",
        -1,
        2,
        0.01
      ),
      gridLinesDensity: num(
        values.gridLinesDensity,
        "Grid line density",
        0,
        1,
        0.01
      ),
    }),

    Background: drawerFolder("Background", {
      backgroundTransparent: {
        value: values.backgroundTransparent,
        label: "Transparent",
      },
      backgroundColor: colorLibraryInputPlugin({
        value: values.backgroundColor,
        label: "Background color",
      }),
      starsEnabled: { value: values.starsEnabled, label: "Stars" },
      meteorsEnabled: { value: values.meteorsEnabled, label: "Meteors" },
      flamesEnabled: { value: values.flamesEnabled, label: "Flames" },
    }),

    "Color mapping": drawerFolder("Color mapping", {
      colorMode: {
        value: values.colorMode,
        label: "Color source",
        options: { Luminance: "luminance", "Source colors": "colors" },
      },
      stripeBlendMode: {
        value: values.stripeBlendMode,
        label: "Stripe blend",
        options: optionsFrom(BLEND_MODES),
      },
    }),

    "Shader output": drawerFolder("Shader output", {
      shaderOpacity: num(values.shaderOpacity, "Opacity", 0, 1, 0.01),
      renderMode: {
        value: values.renderMode,
        label: "Render style",
        options: optionsFrom(RENDER_MODES),
      },
      renderIntensity: num(
        values.renderIntensity,
        "Render intensity",
        0,
        1,
        0.01
      ),
      renderParamA: num(values.renderParamA, "Style parameter A", 0, 1, 0.01),
      renderParamB: num(values.renderParamB, "Style parameter B", 0, 1, 0.01),
      renderParamC: num(values.renderParamC, "Style parameter C", 0, 1, 0.01),
      renderParamD: num(values.renderParamD, "Style parameter D", 0, 1, 0.01),
      renderColorA: colorLibraryInputPlugin({
        value: values.renderColorA,
        label: "Render color A",
      }),
      renderColorB: colorLibraryInputPlugin({
        value: values.renderColorB,
        label: "Render color B",
      }),
    }),

    // Always the closing section, so the authored look can be lifted out.
    Config: copyConfigFolder(onCopyConfig),
  };
}

/**
 * Flat Leva values → the agenda-rain settings record. `stripes` is not a Leva
 * value; the palette table edits it through the runtime handlers, so the
 * current list is carried over from `fallback`.
 */
export function agendaRainFromLevaValues(
  values: Record<string, unknown>,
  fallback: AgendaRainSettings
): AgendaRainSettings {
  const next = { ...fallback } as Record<string, unknown>;
  for (const key of Object.keys(fallback)) {
    if (key === "stripes") continue;
    if (key in values) next[key] = values[key];
  }
  return next as AgendaRainSettings;
}
