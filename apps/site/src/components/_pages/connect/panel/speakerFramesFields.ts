import type { PanelField } from "@tjcages/panels/dev";
import { connectSpeakers } from "../data";
import {
  createSpeakerFramePlacement,
  LEGACY_SPEAKER_FRAME_PANEL_IDS,
  MAX_SPEAKER_FRAME_PLACEMENTS,
  sanitizeSpeakerFramePlacements,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  type SpeakerFramePlacement,
  type SpeakerFrameSettings,
  type SpeakerFrameVariantLook,
} from "../speakers/speaker-frame-controls";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { color, num, optionsFrom, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import { fromEditableControls, toEditableControls, type EditableStripe } from "./stripeAdapter";

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

export const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "difference", "exclusion"];

type SpeakerFramePanelValues = SpeakerFrameSettings & {
  stripes: EditableStripe[];
  invert: boolean;
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  greyStripes: EditableStripe[];
  greyInvert: boolean;
  greyBrightness: number;
  greyExposure: number;
  greyContrast: number;
  greyBlackPoint: number;
  greyWhitePoint: number;
  greyGamma: number;
  whiteStripes: EditableStripe[];
  whiteInvert: boolean;
  whiteBrightness: number;
  whiteExposure: number;
  whiteContrast: number;
  whiteBlackPoint: number;
  whiteWhitePoint: number;
  whiteGamma: number;
};

const lookFromPanel = (
  stripes: unknown,
  invert: unknown,
  brightness: unknown,
  exposure: unknown,
  contrast: unknown,
  blackPoint: unknown,
  whitePoint: unknown,
  gamma: unknown,
  fallback: SpeakerFrameVariantLook,
): SpeakerFrameVariantLook => ({
  stripes: (() => {
    const next = fromEditableControls(Array.isArray(stripes) ? (stripes as EditableStripe[]) : []);
    return next.length > 0 ? next : fallback.stripes.map((stripe) => ({ ...stripe }));
  })(),
  invert: typeof invert === "boolean" ? invert : fallback.invert,
  brightness: typeof brightness === "number" ? brightness : fallback.brightness,
  exposure: typeof exposure === "number" ? exposure : fallback.exposure,
  contrast: typeof contrast === "number" ? contrast : fallback.contrast,
  blackPoint: typeof blackPoint === "number" ? blackPoint : fallback.blackPoint,
  whitePoint: typeof whitePoint === "number" ? whitePoint : fallback.whitePoint,
  gamma: typeof gamma === "number" ? gamma : fallback.gamma,
});

/** Panel values: settings plus flattened orange/white/grey stripe tables. */
export function seedSpeakerFramesPanelValues(settings: SpeakerFrameSettings): PanelValues {
  return {
    ...settings,
    stripes: toEditableControls(settings.orange.stripes),
    invert: settings.orange.invert,
    brightness: settings.orange.brightness,
    exposure: settings.orange.exposure,
    contrast: settings.orange.contrast,
    blackPoint: settings.orange.blackPoint,
    whitePoint: settings.orange.whitePoint,
    gamma: settings.orange.gamma,
    whiteStripes: toEditableControls(settings.white.stripes),
    whiteInvert: settings.white.invert,
    whiteBrightness: settings.white.brightness,
    whiteExposure: settings.white.exposure,
    whiteContrast: settings.white.contrast,
    whiteBlackPoint: settings.white.blackPoint,
    whiteWhitePoint: settings.white.whitePoint,
    whiteGamma: settings.white.gamma,
    greyStripes: toEditableControls(settings.grey.stripes),
    greyInvert: settings.grey.invert,
    greyBrightness: settings.grey.brightness,
    greyExposure: settings.grey.exposure,
    greyContrast: settings.grey.contrast,
    greyBlackPoint: settings.grey.blackPoint,
    greyWhitePoint: settings.grey.whitePoint,
    greyGamma: settings.grey.gamma,
  } satisfies SpeakerFramePanelValues;
}

export function speakerFramesFromPanelValues(values: PanelValues): SpeakerFrameSettings {
  const {
    stripes,
    invert,
    brightness,
    exposure,
    contrast,
    blackPoint,
    whitePoint,
    gamma,
    greyStripes,
    greyInvert,
    greyBrightness,
    greyExposure,
    greyContrast,
    greyBlackPoint,
    greyWhitePoint,
    greyGamma,
    whiteStripes,
    whiteInvert,
    whiteBrightness,
    whiteExposure,
    whiteContrast,
    whiteBlackPoint,
    whiteWhitePoint,
    whiteGamma,
    orange: _orange,
    white: _white,
    grey: _grey,
    placements,
    ...shared
  } = values;
  return {
    ...(shared as unknown as SpeakerFrameSettings),
    placements: sanitizeSpeakerFramePlacements(placements),
    orange: lookFromPanel(
      stripes,
      invert,
      brightness,
      exposure,
      contrast,
      blackPoint,
      whitePoint,
      gamma,
      SPEAKER_FRAME_DEFAULTS.orange,
    ),
    white: lookFromPanel(
      whiteStripes,
      whiteInvert,
      whiteBrightness,
      whiteExposure,
      whiteContrast,
      whiteBlackPoint,
      whiteWhitePoint,
      whiteGamma,
      SPEAKER_FRAME_DEFAULTS.white,
    ),
    grey: lookFromPanel(
      greyStripes,
      greyInvert,
      greyBrightness,
      greyExposure,
      greyContrast,
      greyBlackPoint,
      greyWhitePoint,
      greyGamma,
      SPEAKER_FRAME_DEFAULTS.grey,
    ),
  };
}

const speakerFrameItemFields: PanelField<SpeakerFramePlacement>[] = [
  {
    type: "select",
    key: "imageIndex",
    label: "Image",
    description: "Position is a fraction of this portrait, so it stays put when the grid reflows.",
    options: connectSpeakers.map((speaker, index) => ({
      label: speaker.name,
      value: index,
    })),
  },
  {
    type: "toggle-group",
    key: "variant",
    label: "Variant",
    options: [
      { value: "grey", label: "Overlay" },
      { value: "orange", label: "Orange" },
      { value: "white", label: "White" },
    ],
  },
  { type: "toggle", key: "span", label: "Span neighboring images" },
  { type: "slider", key: "x", label: "X", min: -0.5, max: 1.5, step: 0.01 },
  { type: "slider", key: "y", label: "Y", min: -0.5, max: 1.5, step: 0.01 },
  {
    type: "slider",
    key: "width",
    label: "Width",
    min: 0.05,
    max: 2,
    step: 0.01,
  },
  {
    type: "slider",
    key: "height",
    label: "Height",
    min: 0.05,
    max: 2,
    step: 0.01,
  },
];

export function buildSpeakerFramesSections(): PanelSectionDef[] {
  return [
    {
      id: "Frames",
      title: "Frames",
      defaultOpen: true,
      fields: [
        {
          type: "collection",
          key: "placements",
          label: "Frames",
          addLabel: "Add frame",
          max: MAX_SPEAKER_FRAME_PLACEMENTS,
          newItem: () => createSpeakerFramePlacement(),
          itemLabel: (item, index) => {
            const placement = item as SpeakerFramePlacement;
            const speaker = connectSpeakers[placement.imageIndex]?.name ?? `Speaker ${placement.imageIndex + 1}`;
            const variantLabel = (() => {
              switch (placement.variant) {
                case "orange":
                  return "Orange";
                case "white":
                  return "White";
                case "grey":
                  return "Overlay";
                default: {
                  const unused: never = placement.variant;
                  return unused;
                }
              }
            })();
            return `${index + 1}. ${speaker} · ${variantLabel}`;
          },
          itemFields: speakerFrameItemFields,
        } as PanelField<PanelValues>,
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
      ],
    },
    {
      id: "Orange variant",
      title: "Orange variant",
      defaultOpen: true,
      fields: [
        toggle("invert", "Invert"),
        num("brightness", "Brightness", -1, 1, 0.01),
        num("exposure", "Exposure", -2, 2, 0.01),
        num("contrast", "Contrast", 0, 3, 0.01),
        num("blackPoint", "Black point", 0, 1, 0.01),
        num("whitePoint", "White point", 0, 1, 0.01),
        num("gamma", "Gamma", 0.1, 4, 0.01),
        {
          type: "stripe-table",
          key: "stripes",
          label: "Orange stripe palette",
          library: COLOR_LIBRARY,
        },
        num("posterizeLevels", "Posterize levels", 0, 32, 1),
        num("thresholdBias", "Threshold bias", -1, 1, 0.01),
        num("noiseAmount", "Noise", 0, 1, 0.01),
        num("blurRadius", "Blur", 0, 24, 0.25),
        num("sharpenAmount", "Sharpen", 0, 4, 0.01),
      ],
    },
    {
      id: "White variant",
      title: "White variant",
      defaultOpen: true,
      fields: [
        toggle("whiteInvert", "Invert"),
        num("whiteBrightness", "Brightness", -1, 1, 0.01),
        num("whiteExposure", "Exposure", -2, 2, 0.01),
        num("whiteContrast", "Contrast", 0, 3, 0.01),
        num("whiteBlackPoint", "Black point", 0, 1, 0.01),
        num("whiteWhitePoint", "White point", 0, 1, 0.01),
        num("whiteGamma", "Gamma", 0.1, 4, 0.01),
        {
          type: "stripe-table",
          key: "whiteStripes",
          label: "White stripe palette",
          library: COLOR_LIBRARY,
        },
      ],
    },
    {
      id: "Overlay",
      title: "Overlay",
      defaultOpen: true,
      fields: [
        toggle("greyInvert", "Invert"),
        num("greyBrightness", "Brightness", -1, 1, 0.01),
        num("greyExposure", "Exposure", -2, 2, 0.01),
        num("greyContrast", "Contrast", 0, 3, 0.01),
        num("greyBlackPoint", "Black point", 0, 1, 0.01),
        num("greyWhitePoint", "White point", 0, 1, 0.01),
        num("greyGamma", "Gamma", 0.1, 4, 0.01),
        {
          type: "stripe-table",
          key: "greyStripes",
          label: "Overlay stripe palette",
          library: COLOR_LIBRARY,
        },
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
          storageIds: [SPEAKER_FRAME_PANEL_ID, ...LEGACY_SPEAKER_FRAME_PANEL_IDS],
          toConfig: speakerFramesFromPanelValues,
          seed: seedSpeakerFramesPanelValues,
        }),
      ],
    },
  ];
}
