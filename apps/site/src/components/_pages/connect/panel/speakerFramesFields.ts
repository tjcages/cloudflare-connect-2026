import {
  LEGACY_SPEAKER_FRAME_PANEL_ID,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  type SpeakerFrameSettings,
} from "../speakers/speaker-frame-controls";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { color, num, optionsFrom, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import {
  fromEditableControls,
  toEditableControls,
  type EditableStripe,
} from "./stripeAdapter";

/**
 * The speaker-frame surface of the lab's Leva panel, translated 1:1 into
 * @tjcages/panels field defs: grid geometry, the stripe palette table, tone,
 * sparkle, stripe detail, detected frames, cursor distortion and color
 * mapping — the same drawers, labels and ranges, bound to the site's
 * `SpeakerFrameSettings`.
 */

export const RENDER_MODES = [
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

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
  "exclusion",
];

/** Panel values: the settings record with stripes in the table's row shape. */
export function seedSpeakerFramesPanelValues(
  settings: SpeakerFrameSettings
): PanelValues {
  return { ...settings, stripes: toEditableControls(settings.stripes) };
}

export function speakerFramesFromPanelValues(
  values: PanelValues
): SpeakerFrameSettings {
  return {
    ...(values as unknown as SpeakerFrameSettings),
    stripes: fromEditableControls(values.stripes as EditableStripe[]),
  };
}

export function buildSpeakerFramesSections(): PanelSectionDef[] {
  return [
    {
      id: "Frames",
      title: "Frames",
      defaultOpen: true,
      fields: [
        num("frameCount", "Frame count", 0, 6, 1),
        num("frameWidth", "Frame width", 0.35, 2, 0.01),
        num("frameHeight", "Frame height", 0.35, 2, 0.01),
        num("horizontalSpeed", "Horizontal speed", 0, 4, 0.01),
        num("verticalSpeed", "Vertical speed", 0, 4, 0.01),
        num("cursorWidth", "Pointer width", 0.35, 2, 0.01),
        num("cursorHeight", "Pointer height", 0.35, 2, 0.01),
        num("cursorFollow", "Follow", 0.01, 1, 0.01),
      ],
    },
    {
      id: "Shader output",
      title: "Shader output",
      fields: [
        num("shaderOpacity", "Opacity", 0, 1, 0.01),
        select("renderMode", "Render style", optionsFrom(RENDER_MODES)),
        num("renderIntensity", "Render intensity", 0, 2, 0.01),
        num("renderParamA", "Style parameter A", 0, 1, 0.01),
        num("renderParamB", "Style parameter B", 0, 1, 0.01),
        num("renderParamC", "Style parameter C", 0, 1, 0.01),
        num("renderParamD", "Style parameter D", 0, 1, 0.01),
        color("renderColorA", "Render color A"),
        color("renderColorB", "Render color B"),
      ],
    },
    {
      id: "Grid geometry",
      title: "Grid geometry",
      fields: [
        num("gridCellWidth", "Cell width", 2, 48, 1),
        num("gridCellHeight", "Cell height", 2, 48, 1),
        num("gridGapX", "Horizontal gap", 0, 24, 0.25),
        num("gridGapY", "Vertical gap", 0, 24, 0.25),
        num("gridCornerRadius", "Corner radius", 0, 16, 0.25),
        num("gridOverlap", "Stripe overlap", 0, 4, 0.01),
        select("gridOrientation", "Orientation", {
          Vertical: "vertical",
          Horizontal: "horizontal",
        }),
        num("gridAngle", "Grid angle", -180, 180, 1),
      ],
    },
    {
      id: "Stripe palette",
      title: "Stripe palette",
      defaultOpen: true,
      fields: [
        toggle("stripesEnabled", "Stripes enabled"),
        num("fieldScale", "Field scale", 0.1, 4, 0.01),
        {
          type: "stripe-table",
          key: "stripes",
          label: "Stripe palette",
          library: COLOR_LIBRARY,
        },
      ],
    },
    {
      id: "Tone",
      title: "Tone",
      fields: [
        num("brightness", "Brightness", -1, 1, 0.01),
        num("exposure", "Exposure", -2, 2, 0.01),
        num("contrast", "Contrast", 0, 3, 0.01),
        num("blackPoint", "Black point", 0, 1, 0.01),
        num("whitePoint", "White point", 0, 1, 0.01),
        num("gamma", "Gamma", 0.1, 4, 0.01),
        toggle("invert", "Invert"),
        num("posterizeLevels", "Posterize levels", 0, 32, 1),
        num("thresholdBias", "Threshold bias", -1, 1, 0.01),
        num("noiseAmount", "Noise", 0, 1, 0.01),
        num("blurRadius", "Blur", 0, 24, 0.25),
        num("sharpenAmount", "Sharpen", 0, 4, 0.01),
      ],
    },
    {
      id: "Stripe sparkle",
      title: "Stripe sparkle",
      fields: [
        toggle("sparkleWidthEnabled", "Width shimmer"),
        num("sparkleWidthCoverage", "Width coverage", 0, 1, 0.01),
        num("sparkleSwing", "Width swing", 0, 12, 0.1),
        toggle("sparkleStripeEnabled", "Stripe shimmer"),
        num("sparkleStripeCoverage", "Stripe coverage", 0, 1, 0.01),
        num("sparkleBrightness", "Maximum brightness", 0, 2, 0.01),
        num("sparkleSpeed", "Sparkle speed", 0, 5, 0.01),
        num("sparkleHueDrift", "Hue drift", -180, 180, 1),
        num("sparkleSaturation", "Saturation boost", -1, 2, 0.01),
      ],
    },
    {
      id: "Stripe detail",
      title: "Stripe detail",
      fields: [
        toggle("dotsEnabled", "Stripe dots"),
        num("dotsDensity", "Dot density", 0, 1, 0.01),
        num("dotsVisibility", "Random visibility", 0, 1, 0.01),
        num("dotsSize", "Dot size", 0.25, 8, 0.05),
        num("dotsBrightness", "Dot brightness", 0, 2, 0.01),
        num("dotsHueDrift", "Dot hue drift", -180, 180, 1),
        num("dotsSaturation", "Dot saturation", -1, 2, 0.01),
        toggle("borderEnabled", "Stripe borders"),
        num("borderMinWidth", "Border minimum width", 0, 24, 0.25),
        num("borderDensity", "Border density", 0, 1, 0.01),
        toggle("gridLinesEnabled", "Grid lines"),
        num("gridLinesBrightness", "Grid line brightness", -1, 2, 0.01),
        num("gridLinesDensity", "Grid line density", 0, 1, 0.01),
      ],
    },
    {
      id: "Detected frames",
      title: "Detected frames",
      fields: [
        toggle("engineFramesEnabled", "Detected frame overlay"),
        num("engineFrameThreshold", "Luminance threshold", 0, 1, 0.01),
        num("engineFrameStripeCount", "Highlighted stripes", 1, 24, 1),
        num("engineFrameDistance", "Group distance", 0, 24, 1),
        color("engineFrameColor", "Overlay color"),
      ],
    },
    {
      id: "Cursor distortion",
      title: "Cursor distortion",
      fields: [
        toggle("trailEnabled", "Shader cursor trail"),
        num("trailRadius", "Particle radius", 1, 160, 1),
        num("trailAlpha", "Particle alpha", 0, 1, 0.01),
        num("trailLife", "Particle life", 50, 4000, 10),
        num("trailPush", "Push strength", 0, 160, 1),
      ],
    },
    {
      id: "Color mapping",
      title: "Color mapping",
      fields: [
        select("colorMode", "Color source", {
          Luminance: "luminance",
          "Source colors": "colors",
        }),
        select("stripeBlendMode", "Stripe blend", optionsFrom(BLEND_MODES)),
        num("imageColorLightness", "Source lightness", -1, 1, 0.01),
        num("imageColorDensity", "Source density", 0, 2, 0.01),
        num("imageColorRemoveThin", "Remove thin stripes", 0, 1, 0.01),
        num("imageColorBoostThick", "Boost thick stripes", 0, 2, 0.01),
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
          label: "speaker frames",
          defaults: SPEAKER_FRAME_DEFAULTS,
          // Clear the legacy blob too — load falls back to it.
          storageIds: [SPEAKER_FRAME_PANEL_ID, LEGACY_SPEAKER_FRAME_PANEL_ID],
          toConfig: speakerFramesFromPanelValues,
          seed: seedSpeakerFramesPanelValues,
        }),
      ],
    },
  ];
}
