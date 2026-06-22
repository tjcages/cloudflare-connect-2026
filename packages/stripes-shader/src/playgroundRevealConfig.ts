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

export type PlaygroundRevealType = "wave" | "assembly";

export type PlaygroundAssemblyRevealConfig = {
  speedMinMs: number;
  speedMaxMs: number;
  staggerMs: number;
};

export type PlaygroundRevealConfig = {
  enabled: boolean;
  type: PlaygroundRevealType;
  wave: PlaygroundWaveRevealConfig;
  assembly: PlaygroundAssemblyRevealConfig;
};

export const DEFAULT_PLAYGROUND_REVEAL_CONFIG: PlaygroundRevealConfig = {
  enabled: true,
  type: "wave",
  wave: {
    position: "center",
    durationMs: 1300,
    softness: 0.16,
    waviness: 0.35,
    noiseScale: 14.5,
  },
  assembly: { speedMinMs: 300, speedMaxMs: 1600, staggerMs: 900 },
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

function normalizeRevealType(value: unknown): PlaygroundRevealType {
  return value === "assembly" ? "assembly" : "wave";
}

function normalizeAssemblyRevealConfig(
  input: Partial<PlaygroundAssemblyRevealConfig> | undefined,
): PlaygroundAssemblyRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly;
  const a = input ?? {};
  const speedMinMs = clampInt(a.speedMinMs ?? base.speedMinMs, 100, 30_000, base.speedMinMs);
  const speedMaxMs = Math.max(speedMinMs, clampInt(a.speedMaxMs ?? base.speedMaxMs, 100, 30_000, base.speedMaxMs));
  return {
    speedMinMs,
    speedMaxMs,
    staggerMs: clampInt(a.staggerMs ?? base.staggerMs, 0, 30_000, base.staggerMs),
  };
}

/** Legacy payloads may carry removed presets (random columns); only wave survives. */
export function normalizePlaygroundRevealConfig(
  input:
    | (Partial<Omit<PlaygroundRevealConfig, "wave" | "assembly">> & {
        wave?: Partial<PlaygroundWaveRevealConfig>;
        assembly?: Partial<PlaygroundAssemblyRevealConfig>;
      })
    | undefined,
): PlaygroundRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  if (!input) {
    return {
      enabled: base.enabled,
      type: base.type,
      wave: { ...base.wave },
      assembly: { ...base.assembly },
    };
  }

  const wave = input.wave ?? {};
  return {
    enabled: input.enabled !== false,
    type: normalizeRevealType((input as { type?: unknown }).type),
    wave: {
      position: normalizePlaygroundWaveRevealPosition(wave.position),
      durationMs: clampInt(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs),
      softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
      waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
      noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
    },
    assembly: normalizeAssemblyRevealConfig((input as { assembly?: Partial<PlaygroundAssemblyRevealConfig> }).assembly),
  };
}

export function resolvePlaygroundRevealDurationMs(config: PlaygroundRevealConfig): number {
  const normalized = normalizePlaygroundRevealConfig(config);
  return normalized.type === "assembly"
    ? normalized.assembly.staggerMs + normalized.assembly.speedMaxMs
    : normalized.wave.durationMs;
}

export function isDefaultPlaygroundRevealConfig(input: PlaygroundRevealConfig): boolean {
  const normalized = normalizePlaygroundRevealConfig(input);
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  return (
    normalized.enabled === base.enabled &&
    normalized.type === base.type &&
    normalized.wave.position === base.wave.position &&
    normalized.wave.durationMs === base.wave.durationMs &&
    normalized.wave.softness === base.wave.softness &&
    normalized.wave.waviness === base.wave.waviness &&
    normalized.wave.noiseScale === base.wave.noiseScale &&
    normalized.assembly.speedMinMs === base.assembly.speedMinMs &&
    normalized.assembly.speedMaxMs === base.assembly.speedMaxMs &&
    normalized.assembly.staggerMs === base.assembly.staggerMs
  );
}
