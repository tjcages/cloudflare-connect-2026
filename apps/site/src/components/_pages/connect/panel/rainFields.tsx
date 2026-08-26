import {
  CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
  RAIN_PANEL_ID,
  type RainControlSettings,
} from "../hero/rain-control-settings";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { color, num, optionsFrom, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";
import { ShaderCodeEditor } from "./ShaderCodeEditor";
import { BLEND_MODES } from "./speakerFramesFields";
import { fromEditableControls, toEditableControls, type EditableStripe } from "./stripeAdapter";

/**
 * The hero-rain surface of the lab's Leva panel, translated 1:1 into
 * @tjcages/panels field defs: gaps, grid geometry, stream wave, the stripe
 * palette table, tone, color mapping, camera, background FX — plus the
 * corridor texture source (with the GLSL editor) and the hero's fps cap.
 * Drawer ids, labels and ranges match the leva schema so saved drawer states
 * and tuned values carry over.
 */

/** Panel values: the settings record with stripes in the table's row shape. */
export function seedRainPanelValues(settings: RainControlSettings): PanelValues {
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
      id: "Rain General",
      title: "General",
      defaultOpen: true,
      fields: [toggle("enabled", "Enabled")],
    },
    {
      id: "Background",
      title: "Background",
      defaultOpen: true,
      fields: [
        select("backgroundFillMode", "Fill", {
          Transparent: "transparent",
          Solid: "solid",
          Gradient: "gradient",
        }),
        color("backgroundColor", "Canvas color"),
        select("backgroundGradientDirection", "Gradient direction", {
          "Top to bottom": "topToBottom",
          "Left to right": "leftToRight",
          "Right to left": "rightToLeft",
          "Bottom to top": "bottomToTop",
        }),
        num("backgroundGradientStopCount", "Gradient stops", 2, 4, 1),
        color("backgroundGradientStop0", "Stop 1"),
        color("backgroundGradientStop1", "Stop 2"),
        color("backgroundGradientStop2", "Stop 3"),
        color("backgroundGradientStop3", "Stop 4"),
      ],
    },
    {
      id: "Rain",
      title: "Rain",
      defaultOpen: true,
      fields: [
        toggle("gapsEnabled", "Rain gaps"),
        num("gapsCoverage", "Gap coverage", 0, 1, 0.01),
        num("gapsSpeed", "Gap speed", 0, 10, 0.05),
        num("zoom", "Rain zoom", 0.1, 8, 0.01),
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
      id: "Sparkle",
      title: "Sparkle",
      fields: [
        toggle("sparkleStripeEnabled", "Stripe sparkle"),
        num("sparkleStripeCoverage", "Stripe coverage", 0, 1, 0.01),
        num("sparkleStripeThickestCount", "Thickest levels", 1, 24, 1),
        num("sparkleStripeMaxBrightness", "Brightness boost", 0, 1, 0.01),
        num("sparkleStripeSpeed", "Sparkle speed", 0.05, 10, 0.05),
        num("sparkleStripeHueDriftDeg", "Hue drift", -180, 180, 1),
        num("sparkleStripeSaturationBoost", "Saturation boost", 0, 1, 0.01),
        toggle("sparkleWidthEnabled", "Width shuffle"),
        num("sparkleWidthCoverage", "Width coverage", 0, 1, 0.01),
        num("sparkleWidthSwingPx", "Width swing", 0, 40, 0.25),
        num("sparkleWidthSwingPeriodMin", "Period min", 0.02, 5, 0.01),
        num("sparkleWidthSwingPeriodMax", "Period max", 0.02, 5, 0.01),
        toggle("sparkleMotionEnabled", "Column motion"),
        num("sparkleMotionAmplitudePx", "Move amount", 0, 64, 0.5),
        num("sparkleMotionStaggerPx", "Random pattern", 1, 512, 1),
        num("sparkleMotionMaxOffsetPx", "Max offset", 0, 128, 0.5),
        num("sparkleMotionSpeed", "Motion speed", 0.05, 5, 0.05),
      ],
    },
    {
      id: "Rain Stripe palette",
      title: "Stripe palette",
      defaultOpen: true,
      fields: [
        toggle("stripesEnabled", "Stripes enabled"),
        num("visualFieldScale", "Field scale", 0.1, 4, 0.01),
        num("fieldScale", "Field resolution", 0.05, 2, 0.01),
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
        num("posterizeLevels", "Posterize", 0, 32, 1),
        num("thresholdBias", "Threshold bias", -1, 1, 0.01),
        num("noiseAmount", "Noise", 0, 1, 0.01),
        num("blurRadius", "Blur", 0, 32, 0.25),
        num("sharpenAmount", "Sharpen", 0, 4, 0.01),
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
      id: "Stripe details",
      title: "Stripe details",
      fields: [
        toggle("stripeDotsEnabled", "Dots"),
        num("stripeDotsDensity", "Dot density", 0, 1, 0.01),
        num("stripeDotsRandomVisibility", "Random visibility", 0, 1, 0.01),
        num("stripeDotsSizePx", "Dot size", 0.25, 64, 0.25),
        num("stripeDotsBrightness", "Dot brightness", 0, 4, 0.01),
        num("stripeDotsHueDriftDeg", "Dot hue drift", -180, 180, 1),
        num("stripeDotsSaturationBoost", "Dot saturation", 0, 1, 0.01),
        toggle("stripeBorderEnabled", "Borders"),
        num("stripeBorderMinWidthPx", "Border min width", 0, 64, 0.25),
        num("stripeBorderDensity", "Border density", 0, 1, 0.01),
      ],
    },
    {
      id: "Grid lines",
      title: "Grid lines",
      fields: [
        toggle("gridLinesEnabled", "Enabled"),
        num("gridLinesBrightness", "Brightness", 0, 4, 0.01),
        num("gridLinesDensity", "Density", 0, 1, 0.01),
      ],
    },
    {
      id: "Frames",
      title: "Frames",
      fields: [
        toggle("framesEnabled", "Enabled"),
        num("framesLuminanceThreshold", "Luminance threshold", 0, 1, 0.01),
        num("framesHighlightedStripeCount", "Highlighted stripes", 1, 24, 1),
        num("framesGroupDistanceCells", "Group distance", 0, 64, 1),
        color("framesColor", "Frame color"),
        num("framesFontSizePx", "Font size", 4, 64, 1),
        color("framesCoordinateColor", "Coordinate color"),
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
        num("panX", "Pan X", -1, 1, 0.01),
        num("panY", "Pan Y", -1, 1, 0.01),
      ],
    },
    {
      id: "Background Stars",
      title: "Background Stars",
      fields: [
        toggle("starsEnabled", "Stars"),
        num("starsDensity", "Sparkle %", 0, 100, 1),
        num("starsSizePx", "Star size", 0.25, 64, 0.25),
        num("starsSizeRandomness", "Random size", 0, 1, 0.01),
        num("starsTiltAngleDeg", "Tilt angle", -89, 89, 1),
        num("starsTwinkleSpeed", "Twinkle speed", 0, 10, 0.05),
        num("starsTwinkleAmount", "Twinkle amount", 0, 1, 0.01),
        num("starsOpacity", "Star opacity", 0, 1, 0.01),
        color("starsColor", "Star color"),
      ],
    },
    {
      id: "Background Meteors",
      title: "Background Meteors",
      fields: [
        toggle("meteorsEnabled", "Meteors"),
        num("meteorsRatePerSec", "Meteors / sec", 0.02, 40, 0.02),
        num("meteorsMaxActive", "Max in flight", 1, 64, 1),
        num("meteorsRadiantAngleDeg", "Radiant angle", -180, 180, 1),
        num("meteorsAngleJitterDeg", "Angle spread", 0, 90, 1),
        num("meteorsSpeedScale", "Speed", 0.05, 4, 0.01),
        num("meteorsSpeedVariation", "Speed variation", 0, 1, 0.01),
        num("meteorsTailLengthScale", "Tail length", 0.05, 4, 0.01),
        num("meteorsTailLengthVariation", "Tail variation", 0, 1, 0.01),
        num("meteorsThicknessScale", "Thickness", 0.05, 4, 0.01),
        num("meteorsThicknessVariation", "Thickness variation", 0, 1, 0.01),
        num("meteorsLifetimeMinMs", "Life min (ms)", 60, 10000, 10),
        num("meteorsLifetimeMaxMs", "Life max (ms)", 60, 10000, 10),
        num("meteorsBrightness", "Streak brightness", 0, 4, 0.01),
        num("meteorsHeadGlow", "Head glow", 0, 8, 0.01),
        num("meteorsPushPx", "Field push", 0, 128, 0.5),
        num("meteorsPushFalloffScale", "Push falloff", 0.05, 4, 0.01),
        num("meteorsFadeInMs", "Fade in (ms)", 0, 5000, 10),
        num("meteorsFadeOutMs", "Fade out (ms)", 0, 5000, 10),
        num("meteorsSeed", "Seed", 0, 999999, 1),
      ],
    },
    {
      id: "Background Flames",
      title: "Background Flames",
      fields: [
        toggle("flamesEnabled", "Flames"),
        select("flamesDirection", "Direction", {
          Up: "up",
          Down: "down",
          Left: "left",
          Right: "right",
          "Up + down": "upDown",
          "Left + right": "leftRight",
          Vortex: "vortexSingular",
        }),
        num("flamesMinWidthRatio", "Width min", 0.001, 0.5, 0.001),
        num("flamesMaxWidthRatio", "Width max", 0.001, 0.5, 0.001),
        num("flamesMinHeightRatio", "Height min", 0.001, 0.5, 0.001),
        num("flamesMaxHeightRatio", "Height max", 0.001, 0.5, 0.001),
        num("flamesBaseSpeed", "Base speed", 1, 500, 1),
        num("flamesSpeedVariation", "Speed variation", 0, 1, 0.01),
        num("flamesSpawnInterval", "Spawn interval", 20, 5000, 10),
        num("flamesSpawnJitter", "Spawn jitter", 0, 2000, 10),
        num("flamesMaxActive", "Max active", 1, 200, 1),
        num("flamesEdgeSharpness", "Edge sharpness", 0, 1, 0.01),
        num("flamesOpacityMin", "Opacity min", 0, 1, 0.01),
        num("flamesOpacityMax", "Opacity max", 0, 1, 0.01),
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
              onApply={(glsl) => ctx.setValues({ ...ctx.values, sourceGlsl: glsl })}
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
