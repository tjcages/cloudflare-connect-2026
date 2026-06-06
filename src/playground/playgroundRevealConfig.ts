export type PlaygroundRevealPreset = "wave" | "randomColumns";

export type PlaygroundWaveRevealPosition =
  | "left top"
  | "center top"
  | "right top"
  | "left center"
  | "center"
  | "right center"
  | "left bottom"
  | "center bottom"
  | "right bottom";

export type PlaygroundWaveRevealConfig = {
  position: PlaygroundWaveRevealPosition;
  durationMs: number;
  softness: number;
  waviness: number;
  noiseScale: number;
};

export type PlaygroundRandomColumnsRevealConfig = {
  durationMs: number;
  stagger: number;
  yShift: number;
};

export type PlaygroundRevealConfig = {
  preset: PlaygroundRevealPreset;
  wave: PlaygroundWaveRevealConfig;
  randomColumns: PlaygroundRandomColumnsRevealConfig;
};

export const DEFAULT_PLAYGROUND_REVEAL_CONFIG: PlaygroundRevealConfig = {
  preset: "wave",
  wave: {
    position: "center",
    durationMs: 1800,
    softness: 0.08,
    waviness: 0.08,
    noiseScale: 4,
  },
  randomColumns: {
    durationMs: 1800,
    stagger: 0.8,
    yShift: 0.35,
  },
};

const PLAYGROUND_WAVE_REVEAL_POSITIONS = new Set<PlaygroundWaveRevealPosition>([
  "left top",
  "center top",
  "right top",
  "left center",
  "center",
  "right center",
  "left bottom",
  "center bottom",
  "right bottom",
]);

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function normalizePlaygroundWaveRevealPosition(value: unknown): PlaygroundWaveRevealPosition {
  return PLAYGROUND_WAVE_REVEAL_POSITIONS.has(value as PlaygroundWaveRevealPosition)
    ? (value as PlaygroundWaveRevealPosition)
    : DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave.position;
}

export function normalizePlaygroundRevealConfig(
  input:
    | (Partial<Omit<PlaygroundRevealConfig, "preset" | "wave" | "randomColumns">> & {
        preset?: PlaygroundRevealPreset | "randomColumnsShift";
        wave?: Partial<PlaygroundWaveRevealConfig>;
        randomColumns?: Partial<PlaygroundRandomColumnsRevealConfig>;
        /** @deprecated merged into randomColumns.yShift. */
        randomColumnsShift?: Partial<PlaygroundRandomColumnsRevealConfig>;
      })
    | undefined,
): PlaygroundRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  if (!input) {
    return {
      preset: base.preset,
      wave: { ...base.wave },
      randomColumns: { ...base.randomColumns },
    };
  }

  const wave = input.wave ?? {};
  const randomColumns =
    input.preset === "randomColumnsShift" ? { ...input.randomColumnsShift, ...input.randomColumns } : (input.randomColumns ?? {});
  return {
    preset: input.preset === "randomColumns" || input.preset === "randomColumnsShift" ? "randomColumns" : "wave",
    wave: {
      position: normalizePlaygroundWaveRevealPosition(wave.position),
      durationMs: clampInt(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs),
      softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
      waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
      noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
    },
    randomColumns: {
      durationMs: clampInt(
        randomColumns.durationMs ?? base.randomColumns.durationMs,
        100,
        30_000,
        base.randomColumns.durationMs,
      ),
      stagger: clampNumber(randomColumns.stagger ?? base.randomColumns.stagger, 0, 1, base.randomColumns.stagger),
      yShift: clampNumber(randomColumns.yShift ?? base.randomColumns.yShift, 0, 1, base.randomColumns.yShift),
    },
  };
}

export function resolvePlaygroundRevealDurationMs(config: PlaygroundRevealConfig): number {
  const normalized = normalizePlaygroundRevealConfig(config);
  if (normalized.preset === "randomColumns") {
    return normalized.randomColumns.durationMs;
  }
  return normalized.wave.durationMs;
}

export function isDefaultPlaygroundRevealConfig(input: PlaygroundRevealConfig): boolean {
  const normalized = normalizePlaygroundRevealConfig(input);
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  return (
    normalized.preset === base.preset &&
    normalized.wave.position === base.wave.position &&
    normalized.wave.durationMs === base.wave.durationMs &&
    normalized.wave.softness === base.wave.softness &&
    normalized.wave.waviness === base.wave.waviness &&
    normalized.wave.noiseScale === base.wave.noiseScale &&
    normalized.randomColumns.durationMs === base.randomColumns.durationMs &&
    normalized.randomColumns.stagger === base.randomColumns.stagger &&
    normalized.randomColumns.yShift === base.randomColumns.yShift
  );
}
