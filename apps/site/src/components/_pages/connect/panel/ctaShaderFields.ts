import { CTA_SHADER_DEFAULTS, CTA_SHADER_PANEL_ID, type CtaShaderSettings } from "@/components/cta/cta-shader-controls";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { num, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import { fromEditableControls, toEditableControls, type EditableStripe } from "./stripeAdapter";

export function seedCtaShaderPanelValues(settings: CtaShaderSettings): PanelValues {
  return { ...settings, stripes: toEditableControls(settings.stripes) };
}

export function ctaShaderFromPanelValues(values: PanelValues): CtaShaderSettings {
  return {
    ...(values as unknown as CtaShaderSettings),
    stripes: fromEditableControls(values.stripes as EditableStripe[]),
  };
}

export function buildCtaShaderSections(): PanelSectionDef[] {
  return [
    {
      id: "cta-rain",
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
      id: "cta-grid",
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
      id: "cta-palette",
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
      id: "cta-tone",
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
      id: "cta-sparkle",
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
      id: "cta-detail",
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
      id: "cta-comet",
      title: "Comet logo",
      children: [
        {
          id: "cta-comet-field",
          title: "Field",
          defaultOpen: true,
          fields: [
            num("fieldSpeed", "Field speed", 0, 4, 0.01),
            num("fieldDepth", "Field depth", 0, 8, 0.01),
            num("fieldAlign", "Field align", 0, 1, 0.01),
            num("fieldParticleSize", "Field particle size", 0.05, 3, 0.01),
            num("fieldTrailLength", "Field trail", 0, 2, 0.01),
            num("centerClearRadius", "Clear radius", 0, 400, 1),
            num("centerClearAspect", "Clear aspect", 0.25, 4, 0.01),
            num("centerClearSquareness", "Clear squareness", 0, 4, 0.01),
            num("centerClearLeak", "Clear leak", 0, 0.2, 0.001),
            num("centerClearFalloff", "Clear falloff", 0.1, 8, 0.01),
            num("centerClearOffsetX", "Clear offset X", -200, 200, 1),
            num("centerClearOffsetY", "Clear offset Y", -200, 200, 1),
          ],
        },
        {
          id: "cta-comet-logo",
          title: "Logo",
          fields: [
            num("logoScale", "Logo scale", 0.2, 3, 0.01),
            num("logoDensity", "Logo density", 0.25, 5, 0.01),
            num("logoParticleSize", "Logo particle size", 0.05, 3, 0.01),
            num("logoTrailLength", "Logo trail", 0, 2, 0.01),
          ],
        },
        {
          id: "cta-comet-motion",
          title: "Formation",
          fields: [
            num("formationDuration", "Form duration", 0.1, 4, 0.01),
            num("rejoinDuration", "Rejoin duration", 0.1, 4, 0.01),
            num("formationEase", "Formation ease", 0, 4, 0.01),
            num("formationWiggle", "Wiggle", 0, 2, 0.01),
            num("formationDirectness", "Directness", 0, 1, 0.01),
            num("formationMaxTravel", "Max travel", 0, 2, 0.01),
            num("formationRejoinScale", "Rejoin scale", 0.25, 2, 0.01),
            num("formationRejoinMargin", "Rejoin margin", 0, 1, 0.01),
            num("formationInterrupt", "Interrupt", 0, 4, 0.01),
            num("formationStagger", "Stagger", 0, 2, 0.01),
          ],
        },
        {
          id: "cta-comet-fx",
          title: "Surface FX",
          fields: [
            num("burstProbability", "Burst probability", 0, 1, 0.01),
            num("eruptionFrequency", "Eruption frequency", 0, 0.4, 0.001),
            num("eruptionIntensity", "Eruption intensity", 0, 2, 0.01),
            num("sparkBrightness", "Spark brightness", 0, 2, 0.01),
            num("fireIntensity", "Fire intensity", 0, 2, 0.01),
            num("hotRim", "Hot rim", 0, 2, 0.01),
            num("surfaceEffects", "Surface effects", 0, 2, 0.01),
            num("coronaMist", "Corona mist", 0, 2, 0.01),
          ],
        },
      ],
      fields: [],
    },
    {
      id: "cta-output",
      title: "Shader output",
      fields: [
        num("shaderOpacity", "Opacity", 0, 1, 0.01),
        toggle("edgeMaskEnabled", "Edge mask"),
        num("edgeMaskEnd", "Edge mask end", 0.01, 0.5, 0.01),
        num("edgeMaskPower", "Edge mask power", 0.1, 4, 0.01),
        toggle("clickWaveEnabled", "Click wave"),
      ],
    },
    {
      id: "cta-config",
      title: "Config",
      defaultOpen: true,
      persistOpen: false,
      fields: [
        configToolsField({
          label: "cta shader",
          defaults: CTA_SHADER_DEFAULTS,
          storageIds: [CTA_SHADER_PANEL_ID],
          toConfig: ctaShaderFromPanelValues,
          seed: seedCtaShaderPanelValues,
        }),
      ],
    },
  ];
}
