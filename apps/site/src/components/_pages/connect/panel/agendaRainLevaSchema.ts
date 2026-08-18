import { folder } from "leva";
import type {
  AgendaRainSettings,
  AgendaRainStripeControl,
} from "../agenda/agenda-rain-controls";
import { colorLibraryInputPlugin } from "./colorLibraryInputPlugin";
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

export function buildAgendaRainLevaSchema(values: AgendaRainSettings) {
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

    "Texture source": drawerFolder("Texture source", {
      sourceSpeed: num(values.sourceSpeed, "Source speed", 0, 4, 0.01),
      sourceZoom: num(values.sourceZoom, "Source zoom", 0.2, 5, 0.01),
      sourcePanX: num(values.sourcePanX, "Source pan X", -1, 1, 0.01),
      sourcePanY: num(values.sourcePanY, "Source pan Y", -1, 1, 0.01),
    }),

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
    }),
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
