import { normalizeEngineConfig, type EngineConfig } from "@necatikcl/stripes-engine";
import presetSettings from "./preset.settings.json";

const preset = normalizeEngineConfig(presetSettings.config as Partial<EngineConfig>);

export const EXPERIMENT_BASE_CONFIG = {
  transform: preset.transform,
  adjustments: preset.adjustments,
  background: {
    ...preset.background,
    stars: { ...preset.background.stars, enabled: false },
  },
  grid: preset.grid,
  stripes: preset.stripes,
  stripesEnabled: preset.stripesEnabled,
  fieldScale: preset.fieldScale,
  sparkle: preset.sparkle,
  edgeMask: preset.edgeMask,
  letters: preset.letters,
  colors: preset.colors,
  renderMode: preset.renderMode,
  renderIntensity: preset.renderIntensity,
  renderParams: preset.renderParams,
  renderColorA: preset.renderColorA,
  renderColorB: preset.renderColorB,
} satisfies Partial<EngineConfig>;

export const EXPERIMENT_PRESET_STARS = preset.background.stars;
export const EXPERIMENT_PRESET_REVEAL = preset.reveal;
export const EXPERIMENT_PRESET_CURSOR_TRAIL = preset.cursorTrail;
export const EXPERIMENT_PRESET_CLICK_WAVE = preset.clickWave;
export const EXPERIMENT_PRESET_FLAMES = preset.flames;
