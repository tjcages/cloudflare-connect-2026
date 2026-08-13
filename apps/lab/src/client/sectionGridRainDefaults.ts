/**
 * Section-grid rain = this repo’s factoryDefaults (`DEFAULT_LAB_ENGINE_CONFIG` +
 * `DEFAULT_LAB_SETTINGS`). Same blob Factory reset / lab boot use — the
 * section-grid-generator lineage already in-tree.
 *
 * Do not hand-roll Leva key patches for full reset. Prefer factory config via
 * `sectionGridRainEnterLevaPatch` (live Graphic enter) or
 * applyPresetToStorage + reload (Factory reset / Apply layout).
 */
import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { DEFAULT_LAB_ENGINE_CONFIG } from "../defaultLabConfig";
import { DEFAULT_LAB_SETTINGS, type LabSettings } from "../persistence";
import { applyPresetToStorage, createPreset, type ConfigPreset } from "../presets";
import { clientGraphicFlags, type ClientGraphicMode } from "./clientPresets";

export type SectionGridRainGraphicMode = Extract<ClientGraphicMode, "rain" | "both">;

/** Factory engine with rain layer armed for client Graphic seeding. */
export function sectionGridRainEngineConfig(): ThemedEngineConfig {
  const config = structuredClone(DEFAULT_LAB_ENGINE_CONFIG) as ThemedEngineConfig & {
    sparkle?: { gaps?: { enabled?: boolean; coverage?: number; speed?: number } };
  };
  if (!config.sparkle) config.sparkle = {};
  if (!config.sparkle.gaps) config.sparkle.gaps = { enabled: true, coverage: 0, speed: 1 };
  // Client seeds Hero → Graphic from sparkle.gaps.enabled.
  config.sparkle.gaps.enabled = true;
  return config;
}

export function sectionGridRainStripes() {
  return structuredClone(DEFAULT_LAB_ENGINE_CONFIG.stripes);
}

export type RainSeedStripe = { opacity?: number };

/** Banner 5:1 rain is one opacity-0 stripe + coverage=1. That is not authored rain. */
export function rainEngineNeedsFactorySeed(input: { stripes?: readonly RainSeedStripe[]; coverage?: number }): boolean {
  const stripes = input.stripes ?? [];
  const visible = stripes.filter((stripe) => (stripe.opacity ?? 1) > 0.01);
  if (visible.length < 2) return true;
  if ((input.coverage ?? 0) >= 0.999) return true;
  return false;
}

export function sectionGridRainEditableStripes(): Array<{
  id: string;
  hex: string;
  startFrom: number;
  width: number;
  opacity: number;
}> {
  return sectionGridRainStripes().map((stripe, index) => ({
    id: String(index),
    hex: `#${stripe.color.toString(16).padStart(6, "0")}`,
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));
}

/**
 * Live Leva patches when Graphic first enables Rain (no page reload).
 * Banner 5:1 ships gaps.coverage=1 (blank); factory is continuous cells (0).
 */
export function sectionGridRainEnterLevaPatch(): {
  shader: Record<string, unknown>;
  texture: Record<string, unknown>;
} {
  const config = sectionGridRainEngineConfig();
  const grid = config.grid ?? DEFAULT_LAB_ENGINE_CONFIG.grid;
  const adjustments = config.adjustments ?? DEFAULT_LAB_ENGINE_CONFIG.adjustments;
  return {
    shader: {
      sparkleGapsCoverage: (config.sparkle?.gaps?.coverage ?? 0) * 100,
      sparkleGapsSpeed: config.sparkle?.gaps?.speed ?? 1,
      cellWidth: grid.cellWidth,
      cellHeight: grid.cellHeight,
      gapX: grid.gapX,
      gapY: grid.gapY,
      orientationAngleDeg: grid.angleDeg,
      orientationStackMode: grid.orientation,
      orientationRotationMode: grid.rotationMode,
      orientationOverlapAmount: grid.overlapAmount,
      colorsMode: config.colors?.mode ?? "luminance",
      stripeBlendMode: config.colors?.stripeBlendMode ?? "multiply",
    },
    texture: {
      textureDpr: config.fieldScale ?? DEFAULT_LAB_ENGINE_CONFIG.fieldScale,
      exposure: adjustments.exposure,
      brightness: adjustments.brightness,
      contrast: adjustments.contrast,
      gamma: adjustments.gamma,
    },
  };
}

/**
 * Build a preset from factoryDefaults — identical source as Factory reset,
 * with Graphic-mode flags for Rain / Both.
 */
export function buildSectionGridRainPreset(
  mode: SectionGridRainGraphicMode,
  keep?: Partial<Pick<LabSettings, "canvasWidth" | "canvasHeight" | "clientSizeId" | "backgroundColor">>,
): ConfigPreset {
  const flags = clientGraphicFlags(mode);
  const config = sectionGridRainEngineConfig();
  const lab: Partial<LabSettings> = {
    ...DEFAULT_LAB_SETTINGS,
    ...keep,
    textureSourceMode: "shader",
    shaderPresetId: DEFAULT_LAB_SETTINGS.shaderPresetId || "spiral",
    twizzlerEnabled: flags.twizzlerEnabled,
    // Client Rain authoring uses texture sidebar (Camera / Tone) + shader sidebar.
    textureSidebarOpen: true,
    shaderSidebarOpen: true,
  };
  return createPreset(mode === "both" ? "Section-grid Rain + Twizzler" : "Section-grid Rain", config, lab, true);
}

/** Same storage path as Apply layout / Factory reset. Caller reloads. */
export function applySectionGridRainToStorage(
  mode: SectionGridRainGraphicMode,
  textureId: string,
  keep?: Partial<Pick<LabSettings, "canvasWidth" | "canvasHeight" | "clientSizeId" | "backgroundColor">>,
): void {
  applyPresetToStorage(buildSectionGridRainPreset(mode, keep), textureId);
}
