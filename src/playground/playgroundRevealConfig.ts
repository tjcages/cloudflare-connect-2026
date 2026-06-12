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

export type PlaygroundRevealConfig = {
  enabled: boolean;
  wave: PlaygroundWaveRevealConfig;
};

export const DEFAULT_PLAYGROUND_REVEAL_CONFIG: PlaygroundRevealConfig = {
  enabled: false,
  wave: {
    position: "center",
    durationMs: 1100,
    softness: 0.08,
    waviness: 0.35,
    noiseScale: 0.5,
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

/** Legacy payloads may carry removed presets (random columns); only wave survives. */
export function normalizePlaygroundRevealConfig(
  input:
    | (Partial<Omit<PlaygroundRevealConfig, "wave">> & {
        wave?: Partial<PlaygroundWaveRevealConfig>;
      })
    | undefined,
): PlaygroundRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  if (!input) {
    return {
      enabled: base.enabled,
      wave: { ...base.wave },
    };
  }

  const wave = input.wave ?? {};
  return {
    enabled: input.enabled === true,
    wave: {
      position: normalizePlaygroundWaveRevealPosition(wave.position),
      durationMs: clampInt(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs),
      softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
      waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
      noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
    },
  };
}

export function resolvePlaygroundRevealDurationMs(config: PlaygroundRevealConfig): number {
  return normalizePlaygroundRevealConfig(config).wave.durationMs;
}

export function isDefaultPlaygroundRevealConfig(input: PlaygroundRevealConfig): boolean {
  const normalized = normalizePlaygroundRevealConfig(input);
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  return (
    normalized.enabled === base.enabled &&
    normalized.wave.position === base.wave.position &&
    normalized.wave.durationMs === base.wave.durationMs &&
    normalized.wave.softness === base.wave.softness &&
    normalized.wave.waviness === base.wave.waviness &&
    normalized.wave.noiseScale === base.wave.noiseScale
  );
}
