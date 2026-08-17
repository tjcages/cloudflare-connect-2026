import { normalizeEngineConfig } from "./normalize";
import { diffEngineConfig, resolveThemedConfig } from "./theme";
import type { DeepPartial, ThemedEngineConfig } from "./theme";
import type { EngineConfig } from "./types";

export type ProductionEngineConfig = DeepPartial<EngineConfig>;
export type ProductionThemedEngineConfig = ProductionEngineConfig & {
  dark?: ProductionEngineConfig;
};

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function revealConfig(
  config: EngineConfig["reveal"],
  includeDisabledSelectors: boolean,
): DeepPartial<EngineConfig["reveal"]> | undefined {
  if (!config.enabled) return includeDisabledSelectors ? { enabled: false } : undefined;
  const base = { enabled: true, type: config.type };
  if (config.type === "wave") return { ...base, wave: { ...config.wave } };
  if (config.type === "assembly") return { ...base, assembly: { ...config.assembly } };
  if (config.type === "turbulence") return { ...base, turbulence: { ...config.turbulence } };
  if (config.type === "glitch") return { ...base, glitch: { ...config.glitch } };
  if (config.type === "vortex") return { ...base, vortex: { ...config.vortex } };
  if (config.type === "blackhole") return { ...base, blackhole: { ...config.blackhole } };
  if (config.type === "whirlpool") return { ...base, whirlpool: { ...config.whirlpool } };
  if (config.type === "water") return { ...base, water: { ...config.water } };
  return base;
}

function productionShape(config: EngineConfig, includeDisabledSelectors: boolean): ProductionEngineConfig {
  const stripesActive = config.stripesEnabled;
  const background: DeepPartial<EngineConfig["background"]> = {
    color: config.background.color,
    transparent: config.background.transparent,
  };
  if (stripesActive && !config.background.transparent) {
    if (config.background.gradient.enabled)
      background.gradient = { ...config.background.gradient, stops: [...config.background.gradient.stops] };
    else if (includeDisabledSelectors) background.gradient = { enabled: false };
    if (config.background.grid.enabled) background.grid = { ...config.background.grid };
    else if (includeDisabledSelectors) background.grid = { enabled: false };
  }
  if (config.background.stars.enabled) background.stars = { ...config.background.stars };
  else if (includeDisabledSelectors) background.stars = { enabled: false };
  if (config.background.meteors.enabled) background.meteors = { ...config.background.meteors };
  else if (includeDisabledSelectors) background.meteors = { enabled: false };

  const output: ProductionEngineConfig = {
    transform: { ...config.transform },
    adjustments: { ...config.adjustments },
    background,
    stripesEnabled: config.stripesEnabled,
    fieldScale: config.fieldScale,
    maxFps: config.maxFps,
  };

  if (stripesActive) {
    const { streamGapWave, ...grid } = config.grid;
    output.grid = {
      ...grid,
      ...(streamGapWave.enabled
        ? { streamGapWave: { ...streamGapWave } }
        : includeDisabledSelectors
          ? { streamGapWave: { enabled: false } }
          : {}),
    };
    output.stripes = config.stripes.map((stripe) => ({ ...stripe }));

    const sparkle: DeepPartial<EngineConfig["sparkle"]> = {};
    for (const key of ["gaps", "width", "stripe", "motion"] as const) {
      const block = config.sparkle[key];
      if (block.enabled) sparkle[key] = { ...block };
      else if (includeDisabledSelectors) sparkle[key] = { enabled: false };
    }
    if (Object.keys(sparkle).length > 0) output.sparkle = sparkle;

    if (config.stripeDots.enabled) output.stripeDots = { ...config.stripeDots };
    else if (includeDisabledSelectors) output.stripeDots = { enabled: false };
    if (config.stripeBorder.enabled) output.stripeBorder = { ...config.stripeBorder };
    else if (includeDisabledSelectors) output.stripeBorder = { enabled: false };
    if (config.gridLines.enabled) output.gridLines = { ...config.gridLines };
    else if (includeDisabledSelectors) output.gridLines = { enabled: false };
    // Frames ring clusters of stripe cells, so they ship with the stripes.
    if (config.frames.enabled) output.frames = { ...config.frames };
    else if (includeDisabledSelectors) output.frames = { enabled: false };
    if (config.letters.enabled) output.letters = { ...config.letters };
    else if (includeDisabledSelectors) output.letters = { enabled: false };

    if (config.renderMode !== "sharp") {
      output.renderMode = config.renderMode;
      output.renderIntensity = config.renderIntensity;
      output.renderParams = [...config.renderParams];
      output.renderColorA = config.renderColorA;
      output.renderColorB = config.renderColorB;
    } else if (includeDisabledSelectors) {
      output.renderMode = "sharp";
    }
  }

  const reveal = revealConfig(config.reveal, includeDisabledSelectors);
  if (reveal) output.reveal = reveal;

  if (config.flames.enabled) {
    const { vortexSingular, ...flames } = config.flames;
    output.flames =
      config.flames.direction === "vortexSingular" ? { ...flames, vortexSingular: { ...vortexSingular } } : flames;
  } else if (includeDisabledSelectors) {
    output.flames = { enabled: false };
  }

  if (config.edgeMask.enabled) output.edgeMask = { ...config.edgeMask, sides: { ...config.edgeMask.sides } };
  else if (includeDisabledSelectors) output.edgeMask = { enabled: false };

  if (config.cursorTrail.enabled) {
    const { constellation, comet, ...cursorTrail } = config.cursorTrail;
    if (config.cursorTrail.type === "default") output.cursorTrail = cursorTrail;
    else if (config.cursorTrail.type === "constellation")
      output.cursorTrail = { enabled: true, type: "constellation", constellation: { ...constellation } };
    else if (config.cursorTrail.type === "comet")
      output.cursorTrail = { enabled: true, type: "comet", comet: { ...comet } };
    else output.cursorTrail = { enabled: true, type: "wave" };
  } else if (includeDisabledSelectors) {
    output.cursorTrail = { enabled: false };
  }

  if (config.clickWave.enabled) {
    const { detonation, ...clickWave } = config.clickWave;
    output.clickWave =
      config.clickWave.type === "detonation"
        ? { enabled: true, type: "detonation", detonation: { ...detonation } }
        : clickWave;
  } else if (includeDisabledSelectors) {
    output.clickWave = { enabled: false };
  }

  if (config.colors.mode === "colors") {
    const { gradient, ...colors } = config.colors;
    output.colors = {
      ...colors,
      ...(stripesActive && gradient.enabled
        ? { gradient: { ...gradient, stops: [...gradient.stops] } }
        : includeDisabledSelectors && stripesActive
          ? { gradient: { enabled: false } }
          : {}),
    };
  } else if (includeDisabledSelectors) {
    output.colors = { mode: "luminance" };
  }

  return output;
}

function pickShapedDiff(diff: unknown, shape: unknown): unknown {
  if (!isPlainObject(diff) || !isPlainObject(shape)) return diff;
  const output: PlainRecord = {};
  for (const key of Object.keys(shape)) {
    if (!(key in diff)) continue;
    const diffValue = diff[key];
    const shapeValue = shape[key];
    const value =
      isPlainObject(diffValue) && isPlainObject(shapeValue) ? pickShapedDiff(diffValue, shapeValue) : diffValue;
    if (!isPlainObject(value) || Object.keys(value).length > 0) output[key] = value;
  }
  return output;
}

export function createProductionConfig(config: ThemedEngineConfig): ProductionThemedEngineConfig {
  const lightConfig = normalizeEngineConfig(resolveThemedConfig(config, "light"));
  const light = productionShape(lightConfig, false);
  if (!config.dark) return light;

  const darkConfig = normalizeEngineConfig(resolveThemedConfig(config, "dark"));
  const productionLightConfig = normalizeEngineConfig(light as Partial<EngineConfig>);
  const fullDarkDiff = diffEngineConfig(productionLightConfig, darkConfig);
  const darkShape = productionShape(darkConfig, true);
  const dark = pickShapedDiff(fullDarkDiff, darkShape) as ProductionEngineConfig;
  return Object.keys(dark).length > 0 ? { ...light, dark } : light;
}

export function serializeProductionConfig(config: ThemedEngineConfig): string {
  return `${JSON.stringify(createProductionConfig(config), null, 2)}\n`;
}
