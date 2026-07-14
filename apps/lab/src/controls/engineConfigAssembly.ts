import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig, Stripe } from "@necatikcl/stripes-engine";
import type { SchemaToValues } from "leva/plugin";
import { grayLevelToColor, hexToInt, intToHex, normalizeHexString } from "../lib/color";
import { clamp01 } from "../lib/math";
import { fromEditable } from "./stripeAdapter";
import type { EditableStripe } from "./stripeAdapter";
import { RENDER_MODE_COLORS, RENDER_MODE_INTENSITY, RENDER_MODE_PARAMS } from "./schema/renderModes";
import type { buildShaderSchema } from "./schema/shaderSchema";
import type { buildTextureSchema } from "./schema/textureSchema";

export type EngineControlValues = SchemaToValues<ReturnType<typeof buildTextureSchema>> &
  SchemaToValues<ReturnType<typeof buildShaderSchema>>;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(1e-5, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function applyImageColorDensity(stripes: Stripe[], removeThin: number, boostThick: number): Stripe[] {
  const cutoff = clamp01(removeThin);
  const boost = Math.max(0, boostThick);
  const filtered = stripes.filter((stripe) => stripe.startFrom >= cutoff);
  const source = filtered.length > 0 ? filtered : stripes.slice(-1);

  return source.map((stripe) => {
    const highBandWeight = smoothstep(0.45, 1, stripe.startFrom);
    const expandedStart = Math.max(cutoff, stripe.startFrom - highBandWeight * boost * 0.12);
    const boostedWidth = Math.round(stripe.width * (1 + highBandWeight * boost));
    return {
      ...stripe,
      startFrom: expandedStart,
      width: Math.max(1, Math.min(64, boostedWidth)),
    };
  });
}

export function buildEngineConfig(args: {
  values: EngineControlValues;
  stripes: EditableStripe[];
  backgroundHex: string | null;
  backgroundFillMode: "transparent" | "source" | "solid" | "gradient";
  d: EngineConfig;
}): EngineConfig {
  const { values, stripes, backgroundHex, backgroundFillMode, d } = args;
  const baseStripes = fromEditable(stripes);
  const renderedStripes =
    values.colorsMode === "colors"
      ? applyImageColorDensity(baseStripes, values.imageColorRemoveThin, values.imageColorBoostThick)
      : baseStripes;
  const normalizedBackgroundColor = normalizeHexString(values.backgroundColor, backgroundHex);
  return normalizeEngineConfig({
    adjustments: {
      brightness: values.brightness,
      exposure: values.exposure,
      contrast: values.contrast,
      blackPoint: values.blackPoint,
      whitePoint: values.whitePoint,
      gamma: values.gamma,
      invert: values.colorsMode === "colors" ? false : values.invert,
      posterizeLevels: values.posterizeLevels,
      thresholdBias: values.thresholdBias,
      noiseAmount: values.noiseAmount,
      blurRadius: values.blurRadius,
      sharpenAmount: values.sharpenAmount,
    },
    transform: {
      fit: values.fit,
      zoom: values.zoom,
      panX: values.panX,
      panY: values.panY,
    },
    background: {
      color: hexToInt(normalizedBackgroundColor ?? intToHex(d.background.color)),
      transparent:
        backgroundFillMode === "transparent" ||
        backgroundFillMode === "source" ||
        (backgroundFillMode === "solid" && normalizedBackgroundColor === null),
      gradient: {
        enabled: backgroundFillMode === "gradient",
        direction: values.backgroundGradientDirection,
        stopCount: values.backgroundGradientStopCount,
        stops: [
          hexToInt(values.backgroundGradientStop0),
          hexToInt(values.backgroundGradientStop1),
          hexToInt(values.backgroundGradientStop2),
          hexToInt(values.backgroundGradientStop3),
        ],
      },
      grid: {
        enabled: values.backgroundGridEnabled,
        cellWidth: values.backgroundGridCellWidth,
        cellHeight: values.backgroundGridCellHeight,
        gapX: values.backgroundGridGapX,
        gapY: values.backgroundGridGapY,
        cornerRadius: values.backgroundGridCornerRadius,
        color: hexToInt(values.backgroundGridColor),
        opacity: values.backgroundGridOpacity,
      },
      stars: {
        enabled: values.backgroundStarsEnabled,
        density: values.backgroundStarsDensity,
        sizePx: values.backgroundStarsSizePx,
        sizeRandomness: values.backgroundStarsSizeRandomness,
        tiltAngleDeg: values.backgroundStarsTiltAngleDeg,
        twinkleSpeed: values.backgroundStarsTwinkleSpeed,
        twinkleAmount: values.backgroundStarsTwinkleAmount,
        opacity: values.backgroundStarsOpacity,
        color: hexToInt(values.backgroundStarsColor),
      },
    },
    grid: {
      cellWidth: values.cellWidth,
      cellHeight: values.cellHeight,
      gapX: values.gapX,
      gapY: values.gapY,
      cornerRadius: values.cornerRadius,
      orientation: values.orientationStackMode,
      angleDeg: values.orientationAngleDeg,
      rotationMode: values.orientationWholeRotation ? "global" : "cell",
    },
    stripesEnabled: values.stripesEnabled,
    renderMode: values.renderMode,
    renderIntensity:
      RENDER_MODE_INTENSITY[values.renderMode as string] !== undefined
        ? ((values[(values.renderMode + "Intensity") as keyof typeof values] as number) ?? 1)
        : 1,
    renderParams: (() => {
      const ps = RENDER_MODE_PARAMS[values.renderMode as string];
      const out = [0.5, 0.5, 0.5, 0.5];
      if (ps) {
        ps.forEach((p, i) => {
          const raw = values[p.key as keyof typeof values] as number;
          out[i] = p.px ? (raw - p.px.min) / (p.px.max - p.px.min) : raw;
        });
      }
      return out;
    })(),
    renderColorA: (() => {
      const c = RENDER_MODE_COLORS[values.renderMode as string];
      return c ? hexToInt(values[(values.renderMode + "ColorA") as keyof typeof values] as string) : 0x222222;
    })(),
    renderColorB: (() => {
      const c = RENDER_MODE_COLORS[values.renderMode as string];
      return c ? hexToInt(values[(values.renderMode + "ColorB") as keyof typeof values] as string) : 0xffffff;
    })(),
    fieldScale: values.textureDpr,
    stripes: renderedStripes,
    reveal: {
      enabled: values.revealEnabled,
      type: values.revealType,
      wave: {
        position: values.revealPosition,
        durationMs: values.revealDurationMs,
        softness: values.revealSoftness,
        waviness: values.revealWaviness,
      },
      assembly: {
        sliceSizePx: values.revealSliceSizePx,
        scatterPx: values.revealScatterPx,
        angleJitterDeg: values.revealAngleJitterDeg,
        speedMinMs: values.revealSpeedMinMs,
        speedMaxMs: values.revealSpeedMaxMs,
        staggerMs: values.revealStaggerMs,
      },
    },
    sparkle: {
      gaps: {
        enabled: values.sparkleGapsEnabled,
        coverage: values.sparkleGapsCoverage,
        speed: values.sparkleGapsSpeed,
      },
      width: {
        enabled: values.sparkleWidthEnabled,
        coverage: values.sparkleWidthCoverage,
        swingPx: values.sparkleWidthSwingPx,
        swingPeriodMin: values.sparkleWidthSwingPeriodMin,
        swingPeriodMax: values.sparkleWidthSwingPeriodMax,
      },
      motion: {
        enabled: values.sparkleMotionEnabled,
        amplitudePx: values.sparkleMotionAmplitudePx,
        staggerPx: values.sparkleMotionStaggerPx,
        maxOffsetPx: values.sparkleMotionMaxOffsetPx,
        speed: values.sparkleMotionSpeed,
        direction: values.sparkleMotionDirection,
      },
    },
    letters: {
      enabled: values.lettersEnabled,
      mode: values.lettersMode,
      coverage: values.coverage,
      positionX: values.lettersPositionX,
      positionY: values.lettersPositionY,
      areaWidth: values.lettersAreaWidth,
      areaHeight: values.lettersAreaHeight,
      text: values.lettersText,
      textCopies: values.lettersTextCopies,
      fontFamily: values.lettersFontFamily,
      sizeScale: values.sizeScale,
      shuffleSpeed: values.shuffleSpeed,
    },
    flames: {
      enabled: values.flamesEnabled,
      direction: values.flamesDirection,
      minWidthRatio: values.flamesMinWidthPct / 100,
      maxWidthRatio: values.flamesMaxWidthPct / 100,
      minHeightRatio: values.flamesMinHeightPct / 100,
      maxHeightRatio: values.flamesMaxHeightPct / 100,
      baseSpeedPxPerSec: values.flamesBaseSpeed,
      speedVariation: values.flamesSpeedVariation,
      spawnIntervalMs: values.flamesSpawnInterval,
      spawnJitterMs: values.flamesSpawnJitter,
      maxActive: values.flamesMaxActive,
      edgeSharpness: values.flamesEdgeSharpness,
      opacityMin: values.flamesOpacityMin,
      opacityMax: values.flamesOpacityMax,
    },
    edgeMask: {
      enabled: values.edgeMaskEnabled,
      start: values.edgeMaskStart,
      end: values.edgeMaskEnd,
      power: values.edgeMaskPower,
    },
    cursorTrail: {
      enabled: values.cursorTrailEnabled,
      particleRadius: values.particleRadius,
      particleAlpha: values.particleAlpha,
      particleLifeMs: values.particleLifeMs,
      particleLifeJitterMs: d.cursorTrail.particleLifeJitterMs,
      emitterVelocitySmoothing: d.cursorTrail.emitterVelocitySmoothing,
      particleVelocityScale: d.cursorTrail.particleVelocityScale,
      particleTangentVelocity: d.cursorTrail.particleTangentVelocity,
      particleDamping: d.cursorTrail.particleDamping,
      particleSpacingPx: values.particleSpacingPx,
      maxEmitPerTick: values.maxEmitPerTick,
      spreadMinPx: values.spreadMinPx,
      spreadMaxPx: values.spreadMaxPx,
      spinStrength: values.spinStrength,
      densityRadiusMinScale: d.cursorTrail.densityRadiusMinScale,
      densityRadiusLifeScale: d.cursorTrail.densityRadiusLifeScale,
      pushRadiusScale: values.pushRadiusScale,
      pushStrengthPx: values.pushStrengthPx,
      pushLagPx: d.cursorTrail.pushLagPx,
      pushWobblePx: values.pushWobblePx,
      pushLeadBlackAlpha: d.cursorTrail.pushLeadBlackAlpha,
    },
    clickWave: {
      enabled: values.clickWaveEnabled,
      lifeMs: values.clickWaveLifeMs,
      startRadiusPx: values.clickWaveStartRadiusPx,
      maxRadiusPx: values.clickWaveMaxRadiusPx,
      startStrokeWidthPx: values.clickWaveStartStrokeWidthPx,
      endStrokeWidthPx: values.clickWaveEndStrokeWidthPx,
      maxWaves: values.clickWaveMaxWaves,
      pushStrengthPx: values.clickWavePushStrengthPx,
      pushBandScale: values.clickWavePushBandScale,
      stripeWhiteAlpha: values.clickWaveStripeWhiteAlpha,
    },
    colors: {
      mode: values.colorsMode === "colors" ? "colors" : "luminance",
      stripeBlendMode: values.stripeBlendMode,
      autoDetectBackground: values.colorsMode === "colors" ? false : d.colors.autoDetectBackground,
      backgroundColor:
        values.colorsMode === "colors" ? grayLevelToColor(values.imageColorLevel) : d.colors.backgroundColor,
      gradient: d.colors.gradient,
    },
  });
}
