import { useCallback, useMemo, useState } from "react";
import { useControls, useCreateStore, folder, button } from "leva";
import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { loadInitialConfig } from "../persistence";
import { fromEditable } from "./stripeAdapter";
import type { EditableStripe } from "./stripeAdapter";
import { stripeColorsTablePlugin, stripeColorsTableRuntime, stripeSyncKey } from "./stripeColorsTablePlugin";
import { LAB_TEXTURES, DEFAULT_LAB_TEXTURE_ID } from "../textures";

const TEXTURE_OPTIONS = Object.fromEntries(LAB_TEXTURES.map((t) => [t.label, t.id]));

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
  const d = useMemo(() => normalizeEngineConfig(loadInitialConfig()), []);
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
        texture: { value: DEFAULT_LAB_TEXTURE_ID, options: TEXTURE_OPTIONS, label: "Texture" },
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
        revealOrder: {
          value: d.reveal.assembly.order,
          options: { Center: "center", Edges: "edges", Sweep: "sweep", Random: "random" } as const,
          label: "Order",
          render: (get) => get("Reveal.revealType") === "assembly",
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
        Replay: button(() => onReplay()),
      }),
      Stripes: folder({
        stripeColorsTable: stripeColorsTablePlugin({ value: stripeKey }),
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
        order: values.revealOrder,
        sliceSizePx: values.revealSliceSizePx,
        speedMinMs: values.revealSpeedMinMs,
        speedMaxMs: values.revealSpeedMaxMs,
        staggerMs: values.revealStaggerMs,
      },
    },
  });

  return { config, setControl, textureId: values.texture, store };
}
