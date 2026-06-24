import { useCallback, useMemo, useState } from "react";
import { useControls, useCreateStore, folder, button } from "leva";
import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { loadInitialConfig, loadTextureId } from "../persistence";
import { fromEditable } from "./stripeAdapter";
import type { EditableStripe } from "./stripeAdapter";
import { stripeColorsTablePlugin, stripeColorsTableRuntime, stripeSyncKey } from "./stripeColorsTablePlugin";
import { DEFAULT_LAB_TEXTURE_ID, buildTextureEntries, findTextureEntry } from "../textures";
import { loadManifest } from "../uploads";

const TEXTURE_OPTIONS = Object.fromEntries(buildTextureEntries(loadManifest()).map((t) => [t.label, t.id]));

function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string): number {
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0;
}

let nextStripeId = 0;
function newStripeId(): string {
  return `s${nextStripeId++}`;
}

export interface EngineControlsResult {
  config: EngineConfig;
  setControl: (values: Record<string, unknown>) => void;
  textureId: string;
  store: ReturnType<typeof useCreateStore>;
}

export function useEngineControls(onReplay: () => void): EngineControlsResult {
  const initialTextureId = useMemo(() => {
    const stored = loadTextureId();
    return stored && findTextureEntry(stored, loadManifest()) ? stored : DEFAULT_LAB_TEXTURE_ID;
  }, []);
  const d = useMemo(() => normalizeEngineConfig(loadInitialConfig(initialTextureId)), [initialTextureId]);
  const store = useCreateStore();

  const [stripes, setStripes] = useState<EditableStripe[]>(() =>
    d.stripes.map((s, i) => ({
      id: String(i),
      hex: "#" + s.color.toString(16).padStart(6, "0"),
      startFrom: s.startFrom,
      width: s.width,
    })),
  );

  const stripeKey = stripeSyncKey(stripes);

  const handleColorChange = useCallback((id: string, hex: string) => {
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, hex } : s)));
  }, []);

  const handleThresholdChange = useCallback((id: string, value: number) => {
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, startFrom: value } : s)));
  }, []);

  const handleWidthChange = useCallback((id: string, value: number) => {
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, width: value } : s)));
  }, []);

  const handleColorReorder = useCallback((orderedIds: string[]) => {
    setStripes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });
  }, []);

  const handleAdd = useCallback(() => {
    setStripes((prev) => [...prev, { id: newStripeId(), hex: "#888888", startFrom: 0.5, width: 1 }]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setStripes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  stripeColorsTableRuntime.stripes = stripes;
  stripeColorsTableRuntime.disabled = false;
  stripeColorsTableRuntime.handlers = {
    onColorChange: handleColorChange,
    onThresholdChange: handleThresholdChange,
    onWidthChange: handleWidthChange,
    onColorReorder: handleColorReorder,
    onAdd: handleAdd,
    onRemove: handleRemove,
  };

  const [values, setControl] = useControls(
    () => ({
      Texture: folder({
        texture: { value: initialTextureId, options: TEXTURE_OPTIONS, label: "Texture" },
      }),
      General: folder({
        stripesEnabled: { value: d.stripesEnabled, label: "Stripes enabled" },
        textureDpr: { value: d.fieldScale, min: 0.25, max: 2, step: 0.25, label: "Texture DPR" },
      }),
      "Texture Tone": folder({
        exposure: { value: d.adjustments.exposure, min: -2, max: 2, step: 0.05, label: "Exposure" },
        brightness: { value: d.adjustments.brightness, min: -0.5, max: 0.5, step: 0.01, label: "Brightness" },
        contrast: { value: d.adjustments.contrast, min: 0, max: 2, step: 0.01, label: "Contrast" },
        gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05, label: "Gamma" },
        invert: { value: d.adjustments.invert, label: "Invert luminance" },
      }),
      "Texture Levels": folder({
        blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01, label: "Black point" },
        whitePoint: { value: d.adjustments.whitePoint, min: 0, max: 1, step: 0.01, label: "White point" },
        thresholdBias: { value: d.adjustments.thresholdBias, min: -0.5, max: 0.5, step: 0.01, label: "Threshold bias" },
        posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1, label: "Posterize" },
        noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 0.5, step: 0.01, label: "Noise" },
        blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 1, label: "Blur" },
        sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1, label: "Sharpen" },
      }),
      "Texture Source": folder({
        fit: {
          value: d.transform.fit,
          options: { Stretch: "stretch", Cover: "cover", Contain: "contain" } as const,
          label: "Fit",
        },
        zoom: { value: d.transform.zoom, min: 0.5, max: 4, step: 0.01, label: "Zoom" },
        panX: { value: d.transform.panX, min: -1, max: 1, step: 0.01, label: "Pan X" },
        panY: { value: d.transform.panY, min: -1, max: 1, step: 0.01, label: "Pan Y" },
      }),
      Background: folder({
        backgroundColor: { value: intToHex(d.background.color), label: "Color" },
      }),
      Grid: folder({
        cellWidth: { value: d.grid.cellWidth, min: 1, max: 24, step: 1, label: "Cell width" },
        cellHeight: { value: d.grid.cellHeight, min: 1, max: 24, step: 1, label: "Cell height" },
        gapX: { value: d.grid.gapX, min: 0, max: 24, step: 0.5, label: "Gap X" },
        gapY: { value: d.grid.gapY, min: 0, max: 24, step: 0.5, label: "Gap Y" },
        cornerRadius: { value: d.grid.cornerRadius, min: 0, max: 24, step: 0.5, label: "Corner radius" },
        orientation: {
          value: d.grid.orientation,
          options: { Vertical: "vertical", Horizontal: "horizontal" } as const,
          label: "Orientation",
        },
      }),
      Reveal: folder({
        revealEnabled: { value: true, label: "Enabled" },
        revealType: {
          value: d.reveal.type,
          options: { Wave: "wave", Assembly: "assembly" } as const,
          label: "Type",
        },
        revealPosition: {
          value: d.reveal.wave.position,
          options: {
            Center: "center",
            "Left Top": "left top",
            "Center Top": "center top",
            "Right Top": "right top",
            "Left Center": "left center",
            "Right Center": "right center",
            "Left Bottom": "left bottom",
            "Center Bottom": "center bottom",
            "Right Bottom": "right bottom",
          } as const,
          label: "Position",
          render: (get) => get("Reveal.revealType") === "wave",
        },
        revealDurationMs: {
          value: d.reveal.wave.durationMs,
          min: 100,
          max: 30000,
          step: 50,
          label: "Duration (ms)",
          render: (get) => get("Reveal.revealType") === "wave",
        },
        revealSoftness: {
          value: d.reveal.wave.softness,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Softness",
          render: (get) => get("Reveal.revealType") === "wave",
        },
        revealWaviness: {
          value: d.reveal.wave.waviness,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Waviness",
          render: (get) => get("Reveal.revealType") === "wave",
        },
        revealSliceSizePx: {
          value: d.reveal.assembly.sliceSizePx,
          min: 8,
          max: 200,
          step: 1,
          label: "Slice size (px)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        revealSpeedMinMs: {
          value: d.reveal.assembly.speedMinMs,
          min: 100,
          max: 30000,
          step: 50,
          label: "Speed min (ms)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        revealSpeedMaxMs: {
          value: d.reveal.assembly.speedMaxMs,
          min: 100,
          max: 30000,
          step: 50,
          label: "Speed max (ms)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        revealStaggerMs: {
          value: d.reveal.assembly.staggerMs,
          min: 0,
          max: 30000,
          step: 50,
          label: "Stagger (ms)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        revealScatterPx: {
          value: d.reveal.assembly.scatterPx,
          min: 0,
          max: 300,
          step: 1,
          label: "Scatter (px)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        revealAngleJitterDeg: {
          value: d.reveal.assembly.angleJitterDeg,
          min: 0,
          max: 90,
          step: 1,
          label: "Angle jitter (°)",
          render: (get) => get("Reveal.revealType") === "assembly",
        },
        Replay: button(() => onReplay()),
      }),
      Stripes: folder({
        stripeColorsTable: stripeColorsTablePlugin({ value: stripeKey }),
        colorsMode: {
          value: d.colors.mode,
          options: { Luminance: "luminance", Colors: "colors" } as const,
          label: "Color mode",
        },
        colorsAutoDetectBg: {
          value: d.colors.autoDetectBackground,
          label: "Auto-detect background",
          render: (get) => get("Stripes.colorsMode") === "colors",
        },
        colorsBackgroundColor: {
          value: intToHex(d.colors.backgroundColor),
          label: "Background color",
          render: (get) => get("Stripes.colorsMode") === "colors" && get("Stripes.colorsAutoDetectBg") === false,
        },
      }),
      Sparkle: folder({
        sparkleGapsEnabled: { value: d.sparkle.gaps.enabled, label: "Gaps enabled" },
        sparkleGapsCoverage: {
          value: d.sparkle.gaps.coverage,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Gap active %",
          render: (get) => get("Sparkle.sparkleGapsEnabled") === true,
        },
        sparkleGapsSpeed: {
          value: d.sparkle.gaps.speed,
          min: 0.05,
          max: 3,
          step: 0.05,
          label: "Gap speed",
          render: (get) => get("Sparkle.sparkleGapsEnabled") === true,
        },
        sparkleWidthEnabled: { value: d.sparkle.width.enabled, label: "Width shuffle enabled" },
        sparkleWidthCoverage: {
          value: d.sparkle.width.coverage,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Width active %",
          render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
        },
        sparkleWidthSpeed: {
          value: d.sparkle.width.speed,
          min: 0.05,
          max: 3,
          step: 0.05,
          label: "Width speed",
          render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
        },
        sparkleWidthSwingPx: {
          value: d.sparkle.width.swingPx,
          min: 0,
          max: 40,
          step: 0.25,
          label: "Width swing (px)",
          render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
        },
      }),
      Letters: folder({
        lettersEnabled: { value: d.letters.enabled, label: "Enabled" },
        coverage: {
          value: d.letters.coverage,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Coverage",
          render: (get) => get("Letters.lettersEnabled") === true,
        },
        sizeScale: {
          value: d.letters.sizeScale,
          min: 0.1,
          max: 1,
          step: 0.05,
          label: "Size scale",
          render: (get) => get("Letters.lettersEnabled") === true,
        },
        shuffleSpeed: {
          value: d.letters.shuffleSpeed,
          min: 0.05,
          max: 3,
          step: 0.05,
          label: "Shuffle speed",
          render: (get) => get("Letters.lettersEnabled") === true,
        },
      }),
      "Edge Mask": folder({
        edgeMaskEnabled: { value: d.edgeMask.enabled, label: "Enabled" },
        edgeMaskStart: {
          value: d.edgeMask.start,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "Start inset",
          render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
        },
        edgeMaskEnd: {
          value: d.edgeMask.end,
          min: 0,
          max: 0.5,
          step: 0.005,
          label: "End inset",
          render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
        },
        edgeMaskPower: {
          value: d.edgeMask.power,
          min: 0.1,
          max: 4,
          step: 0.05,
          label: "Power",
          render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
        },
      }),
      "Cursor Trail": folder({
        cursorTrailEnabled: { value: d.cursorTrail.enabled, label: "Enabled" },
        particleRadius: {
          value: d.cursorTrail.particleRadius,
          min: 0.5,
          max: 80,
          step: 0.5,
          label: "Particle radius",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        particleAlpha: {
          value: d.cursorTrail.particleAlpha,
          min: 0,
          max: 1,
          step: 0.005,
          label: "Particle alpha",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        particleLifeMs: {
          value: d.cursorTrail.particleLifeMs,
          min: 50,
          max: 10000,
          step: 10,
          label: "Particle life (ms)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        particleSpacingPx: {
          value: d.cursorTrail.particleSpacingPx,
          min: 0.5,
          max: 80,
          step: 0.5,
          label: "Particle spacing (px)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        maxEmitPerTick: {
          value: d.cursorTrail.maxEmitPerTick,
          min: 1,
          max: 200,
          step: 1,
          label: "Max emit/tick",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        spreadMinPx: {
          value: d.cursorTrail.spreadMinPx,
          min: 0,
          max: 80,
          step: 0.5,
          label: "Spread min (px)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        spreadMaxPx: {
          value: d.cursorTrail.spreadMaxPx,
          min: 0,
          max: 120,
          step: 0.5,
          label: "Spread max (px)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        spinStrength: {
          value: d.cursorTrail.spinStrength,
          min: 0,
          max: 0.2,
          step: 0.001,
          label: "Spin strength",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        pushStrengthPx: {
          value: d.cursorTrail.pushStrengthPx,
          min: 0,
          max: 120,
          step: 1,
          label: "Push strength (px)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        pushRadiusScale: {
          value: d.cursorTrail.pushRadiusScale,
          min: 0,
          max: 8,
          step: 0.05,
          label: "Push radius scale",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
        pushWobblePx: {
          value: d.cursorTrail.pushWobblePx,
          min: 0,
          max: 80,
          step: 1,
          label: "Push wobble (px)",
          render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
        },
      }),
      "Click Wave": folder({
        clickWaveEnabled: { value: d.clickWave.enabled, label: "Enabled" },
        clickWaveLifeMs: {
          value: d.clickWave.lifeMs,
          min: 80,
          max: 10000,
          step: 10,
          label: "Life (ms)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveStartRadiusPx: {
          value: d.clickWave.startRadiusPx,
          min: 1,
          max: 120,
          step: 1,
          label: "Start radius (px)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveMaxRadiusPx: {
          value: d.clickWave.maxRadiusPx,
          min: 4,
          max: 600,
          step: 2,
          label: "Max radius (px)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveStartStrokeWidthPx: {
          value: d.clickWave.startStrokeWidthPx,
          min: 0.5,
          max: 80,
          step: 0.5,
          label: "Start stroke (px)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveEndStrokeWidthPx: {
          value: d.clickWave.endStrokeWidthPx,
          min: 0.25,
          max: 40,
          step: 0.25,
          label: "End stroke (px)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveMaxWaves: {
          value: d.clickWave.maxWaves,
          min: 1,
          max: 32,
          step: 1,
          label: "Max waves",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWavePushStrengthPx: {
          value: d.clickWave.pushStrengthPx,
          min: 0,
          max: 200,
          step: 1,
          label: "Push strength (px)",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWavePushBandScale: {
          value: d.clickWave.pushBandScale,
          min: 1,
          max: 8,
          step: 0.1,
          label: "Push band scale",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
        clickWaveStripeWhiteAlpha: {
          value: d.clickWave.stripeWhiteAlpha,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Stripe white alpha",
          render: (get) => get("Click Wave.clickWaveEnabled") === true,
        },
      }),
      "Background Flames": folder({
        flamesEnabled: { value: d.flames.enabled, label: "Enabled" },
        flamesDirection: {
          value: d.flames.direction,
          options: { Up: "up", Down: "down", Left: "left", Right: "right" } as const,
          label: "Direction",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesMinWidthPct: {
          value: d.flames.minWidthRatio * 100,
          min: 0.1,
          max: 50,
          step: 0.1,
          label: "Width min %",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesMaxWidthPct: {
          value: d.flames.maxWidthRatio * 100,
          min: 0.1,
          max: 50,
          step: 0.1,
          label: "Width max %",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesMinHeightPct: {
          value: d.flames.minHeightRatio * 100,
          min: 0.1,
          max: 50,
          step: 0.1,
          label: "Height min %",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesMaxHeightPct: {
          value: d.flames.maxHeightRatio * 100,
          min: 0.1,
          max: 50,
          step: 0.1,
          label: "Height max %",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesBaseSpeed: {
          value: d.flames.baseSpeedPxPerSec,
          min: 1,
          max: 500,
          step: 1,
          label: "Base speed (px/s)",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesSpeedVariation: {
          value: d.flames.speedVariation,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Speed variation",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesSpawnInterval: {
          value: d.flames.spawnIntervalMs,
          min: 20,
          max: 5000,
          step: 10,
          label: "Spawn interval (ms)",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesSpawnJitter: {
          value: d.flames.spawnJitterMs,
          min: 0,
          max: 2000,
          step: 10,
          label: "Spawn jitter (ms)",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesMaxActive: {
          value: d.flames.maxActive,
          min: 1,
          max: 200,
          step: 1,
          label: "Max active",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesEdgeSharpness: {
          value: d.flames.edgeSharpness,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Edge sharpness",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesOpacityMin: {
          value: d.flames.opacityMin,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Opacity min",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
        flamesOpacityMax: {
          value: d.flames.opacityMax,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Opacity max",
          render: (get) => get("Background Flames.flamesEnabled") === true,
        },
      }),
    }),
    { store },
    [stripeKey],
  );

  const config = normalizeEngineConfig({
    adjustments: {
      brightness: values.brightness,
      exposure: values.exposure,
      contrast: values.contrast,
      blackPoint: values.blackPoint,
      whitePoint: values.whitePoint,
      gamma: values.gamma,
      invert: values.invert,
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
    background: { color: hexToInt(values.backgroundColor) },
    grid: {
      cellWidth: values.cellWidth,
      cellHeight: values.cellHeight,
      gapX: values.gapX,
      gapY: values.gapY,
      cornerRadius: values.cornerRadius,
      orientation: values.orientation,
    },
    stripesEnabled: values.stripesEnabled,
    fieldScale: values.textureDpr,
    stripes: fromEditable(stripes),
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
        speed: values.sparkleWidthSpeed,
        swingPx: values.sparkleWidthSwingPx,
      },
    },
    letters: {
      enabled: values.lettersEnabled,
      coverage: values.coverage,
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
      mode: values.colorsMode,
      autoDetectBackground: values.colorsAutoDetectBg,
      backgroundColor: hexToInt(values.colorsBackgroundColor),
    },
  });

  return { config, setControl, textureId: values.texture, store };
}
