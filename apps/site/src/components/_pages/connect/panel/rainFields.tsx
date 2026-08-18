import {
  CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
  RAIN_PANEL_ID,
  type RainControlSettings,
} from "../hero/rain-control-settings";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { num, optionsFrom, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import { ShaderCodeEditor } from "./ShaderCodeEditor";
import { BLEND_MODES } from "./speakerFramesFields";
import {
  fromEditableControls,
  toEditableControls,
  type EditableStripe,
} from "./stripeAdapter";

/**
 * The hero-rain surface of the lab's Leva panel, translated 1:1 into
 * @tjcages/panels field defs: gaps, grid geometry, stream wave, the stripe
 * palette table, tone, color mapping, camera, background FX — plus the
 * corridor texture source (with the GLSL editor) and the hero's fps cap.
 * Drawer ids, labels and ranges match the leva schema so saved drawer states
 * and tuned values carry over.
 */

/** Panel values: the settings record with stripes in the table's row shape. */
export function seedRainPanelValues(
  settings: RainControlSettings
): PanelValues {
  return { ...settings, stripes: toEditableControls(settings.stripes) };
}

export function rainFromPanelValues(values: PanelValues): RainControlSettings {
  return {
    ...(values as unknown as RainControlSettings),
    stripes: fromEditableControls(values.stripes as EditableStripe[]),
  };
}

export function buildRainSections(): PanelSectionDef[] {
  return [
    {
      id: "Rain",
      title: "Rain",
      defaultOpen: true,
      fields: [
        toggle("gapsEnabled", "Rain gaps"),
        num("gapsCoverage", "Gap coverage", 0, 1, 0.01),
        num("gapsSpeed", "Gap speed", 0, 10, 0.05),
        num("maxFps", "Max FPS (0 = off)", 0, 120, 1),
        num("topFadeOffsetPct", "Fade offset %", 0, 100, 1),
        num("topFadePct", "Fade height %", 0, 100, 1),
      ],
    },
    {
      id: "Rain Grid geometry",
      title: "Grid geometry",
      defaultOpen: true,
      fields: [
        num("gridCellWidth", "Cell width", 1, 200, 1),
        num("gridCellHeight", "Cell height", 1, 200, 1),
        num("gridGapX", "Horizontal gap", 0, 60, 0.25),
        num("gridGapY", "Vertical gap", 0, 60, 0.25),
        num("gridCornerRadius", "Corner radius", 0, 16, 0.25),
        select("gridOrientation", "Orientation", {
          Vertical: "vertical",
          Horizontal: "horizontal",
        }),
        select("gridRotationMode", "Rotation mode", {
          Cell: "cell",
          Overlap: "overlap",
        }),
        num("gridAngle", "Grid angle", -180, 180, 1),
        num("gridOverlap", "Stripe overlap", 0, 4, 0.01),
      ],
    },
    {
      id: "Rain Stream wave",
      title: "Stream wave",
      fields: [
        toggle("waveEnabled", "Stream wave"),
        num("waveSqueeze", "Squeeze", 0, 1, 0.01),
        num("waveWavelengthCells", "Wavelength (cells)", 1, 60, 1),
        num("waveSpeed", "Wave speed", -20, 20, 0.1),
        num("wavePhaseDeg", "Phase", -360, 360, 1),
      ],
    },
    {
      id: "Rain Stripe palette",
      title: "Stripe palette",
      defaultOpen: true,
      fields: [
        toggle("stripesEnabled", "Stripes enabled"),
        num("fieldScale", "Field scale", 0.05, 2, 0.01),
        {
          type: "stripe-table",
          key: "stripes",
          label: "Stripe palette",
          library: COLOR_LIBRARY,
        },
      ],
    },
    {
      id: "Rain Tone",
      title: "Tone",
      fields: [
        num("brightness", "Brightness", -1, 1, 0.01),
        num("exposure", "Exposure", -2, 2, 0.01),
        num("contrast", "Contrast", 0, 3, 0.01),
        num("blackPoint", "Black point", 0, 1, 0.01),
        num("whitePoint", "White point", 0, 1, 0.01),
        num("gamma", "Gamma", 0.1, 4, 0.01),
        toggle("invert", "Invert"),
      ],
    },
    {
      id: "Rain Color mapping",
      title: "Color mapping",
      fields: [
        select("colorMode", "Color source", {
          Luminance: "luminance",
          "Source colors": "colors",
        }),
        select("stripeBlendMode", "Stripe blend", optionsFrom(BLEND_MODES)),
      ],
    },
    {
      id: "Rain Camera",
      title: "Camera",
      fields: [
        select("fit", "Fit", {
          Width: "width",
          Height: "height",
          Cover: "cover",
          Contain: "contain",
          Stretch: "stretch",
        }),
        num("zoom", "Zoom", 0.1, 8, 0.01),
        num("panX", "Pan X", -1, 1, 0.01),
        num("panY", "Pan Y", -1, 1, 0.01),
      ],
    },
    {
      id: "Rain Background FX",
      title: "Background FX",
      fields: [
        toggle("starsEnabled", "Stars"),
        num("starsDensity", "Star density", 0, 60, 1),
        num("starsSizePx", "Star size", 1, 24, 1),
        toggle("meteorsEnabled", "Meteors"),
        num("meteorsRatePerSec", "Meteor rate /s", 0, 10, 0.02),
        num("meteorsMaxActive", "Max meteors", 0, 64, 1),
        toggle("flamesEnabled", "Flames"),
        num("flamesMaxActive", "Max flames", 0, 80, 1),
      ],
    },
    {
      id: "Rain Texture source",
      title: "Texture source",
      fields: [
        num("sourceSpeed", "Time speed", 0, 4, 0.05),
        num("sourceWidth", "Source width", 256, 2048, 64),
        num("sourceHeight", "Source height", 256, 2048, 64),
        {
          type: "site-custom",
          key: "sourceGlsl",
          render: (ctx) => (
            <ShaderCodeEditor
              onApply={(glsl) =>
                ctx.setValues({ ...ctx.values, sourceGlsl: glsl })
              }
              value={String(ctx.values.sourceGlsl ?? "")}
            />
          ),
        },
      ],
    },
    // Always the closing section, so the authored look can be lifted out.
    {
      id: "Config",
      title: "Config",
      defaultOpen: true,
      persistOpen: false,
      fields: [
        configToolsField({
          label: "hero rain",
          defaults: CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
          storageIds: [RAIN_PANEL_ID],
          toConfig: rainFromPanelValues,
          seed: seedRainPanelValues,
        }),
      ],
    },
  ];
}
