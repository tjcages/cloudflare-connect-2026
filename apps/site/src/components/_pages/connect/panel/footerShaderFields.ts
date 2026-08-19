import {
  FOOTER_SHADER_DEFAULTS,
  FOOTER_SHADER_PANEL_ID,
  type FooterShaderSettings,
} from "@/components/footer/footer-shader-controls";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { color, num, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import { fromEditableControls, toEditableControls, type EditableStripe } from "./stripeAdapter";

export function seedFooterShaderPanelValues(settings: FooterShaderSettings): PanelValues {
  return { ...settings, stripes: toEditableControls(settings.stripes) };
}

export function footerShaderFromPanelValues(values: PanelValues): FooterShaderSettings {
  return {
    ...(values as unknown as FooterShaderSettings),
    stripes: fromEditableControls(values.stripes as EditableStripe[]),
  };
}

export function buildFooterShaderSections(): PanelSectionDef[] {
  return [
    {
      id: "footer-rain",
      title: "Rain",
      defaultOpen: true,
      fields: [
        toggle("rainEnabled", "Rain streams"),
        num("gapsCoverage", "Gap coverage", 0, 0.95, 0.01),
        num("gapsSpeed", "Gap speed", 0, 5, 0.01),
        toggle("waveEnabled", "Stream wave"),
        num("waveSqueeze", "Wave squeeze", 0, 1, 0.01),
        num("waveWavelengthCells", "Wave length", 2, 64, 1),
        num("waveSpeed", "Wave speed", -10, 10, 0.01),
        num("wavePhaseDeg", "Wave phase", -180, 180, 1),
      ],
    },
    {
      id: "footer-grid",
      title: "Grid geometry",
      defaultOpen: true,
      fields: [
        num("gridCellWidth", "Cell width", 1, 48, 1),
        num("gridCellHeight", "Cell height", 1, 48, 1),
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
      id: "footer-palette",
      title: "Stripe palette",
      defaultOpen: true,
      fields: [
        toggle("stripesEnabled", "Stripes enabled"),
        num("fieldScale", "Field scale", 0.25, 2, 0.01),
        {
          type: "stripe-table",
          key: "stripes",
          label: "Stripe palette",
          library: COLOR_LIBRARY,
        },
      ],
    },
    {
      id: "footer-tone",
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
      id: "footer-sparkle",
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
        toggle("motionEnabled", "Stripe motion"),
        num("motionAmplitude", "Motion amplitude", 0, 64, 0.1),
        num("motionStagger", "Motion stagger", 0, 256, 1),
        num("motionMaxOffset", "Motion max offset", 0, 128, 0.5),
        num("motionSpeed", "Motion speed", 0, 5, 0.01),
        select("motionDirection", "Motion direction", {
          "Left to right": "leftToRight",
          "Right to left": "rightToLeft",
        }),
      ],
    },
    {
      id: "footer-detail",
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
      id: "footer-fx",
      title: "Footer FX",
      fields: [
        toggle("flamesEnabled", "Flames"),
        toggle("engineFramesEnabled", "Detected frames"),
        num("engineFrameThreshold", "Frame luminance", 0, 1, 0.01),
        num("engineFrameStripeCount", "Highlighted stripes", 1, 24, 1),
        num("engineFrameDistance", "Group distance", 0, 24, 1),
        color("engineFrameColor", "Frame color"),
        toggle("trailEnabled", "Cursor trail"),
        num("trailAlpha", "Trail alpha", 0, 1, 0.01),
        num("trailLife", "Trail life", 50, 4000, 10),
        num("shaderOpacity", "Opacity", 0, 1, 0.01),
      ],
    },
    {
      id: "footer-config",
      title: "Config",
      defaultOpen: true,
      persistOpen: false,
      fields: [
        configToolsField({
          label: "footer shader",
          defaults: FOOTER_SHADER_DEFAULTS,
          storageIds: [FOOTER_SHADER_PANEL_ID],
          toConfig: footerShaderFromPanelValues,
          seed: seedFooterShaderPanelValues,
        }),
      ],
    },
  ];
}
