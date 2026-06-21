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

export type PlaygroundAssemblyRevealOrder = "center" | "edges" | "sweep" | "random";
export type PlaygroundAssemblyRevealFrom = "scatter" | "radial" | "edge";

export type PlaygroundAssemblyRevealConfig = {
  order: PlaygroundAssemblyRevealOrder;
  from: PlaygroundAssemblyRevealFrom;
  durationMs: number;
  spread: number;
  glowSize: number;
  flight: number;
  overshoot: boolean;
};

export const ASSEMBLY_ORDER_TO_INDEX: Record<PlaygroundAssemblyRevealOrder, number> = {
  center: 0,
  edges: 1,
  sweep: 2,
  random: 3,
};

export type PlaygroundRevealConfig = {
  enabled: boolean;
  type: PlaygroundRevealType;
  wave: PlaygroundWaveRevealConfig;
  assembly: PlaygroundAssemblyRevealConfig;
};

export const DEFAULT_PLAYGROUND_REVEAL_CONFIG: PlaygroundRevealConfig = {
  enabled: false,
  type: "wave",
  wave: {
    position: "center",
    durationMs: 1100,
    softness: 0.08,
    waviness: 0.35,
    noiseScale: 0.5,
  },
  assembly: {
    order: "center",
    from: "scatter",
    durationMs: 2600,
    spread: 0.85,
    glowSize: 42,
    flight: 0.5,
    overshoot: false,
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

const ASSEMBLY_REVEAL_ORDERS = new Set<PlaygroundAssemblyRevealOrder>(["center", "edges", "sweep", "random"]);
const ASSEMBLY_REVEAL_FROMS = new Set<PlaygroundAssemblyRevealFrom>(["scatter", "radial", "edge"]);

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

function normalizeAssemblyOrder(value: unknown): PlaygroundAssemblyRevealOrder {
  return ASSEMBLY_REVEAL_ORDERS.has(value as PlaygroundAssemblyRevealOrder)
    ? (value as PlaygroundAssemblyRevealOrder)
    : DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.order;
}

function normalizeAssemblyFrom(value: unknown): PlaygroundAssemblyRevealFrom {
  return ASSEMBLY_REVEAL_FROMS.has(value as PlaygroundAssemblyRevealFrom)
    ? (value as PlaygroundAssemblyRevealFrom)
    : DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.from;
}

function normalizeAssemblyRevealConfig(
  input: Partial<PlaygroundAssemblyRevealConfig> | undefined,
): PlaygroundAssemblyRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly;
  const a = input ?? {};
  return {
    order: normalizeAssemblyOrder(a.order),
    from: normalizeAssemblyFrom(a.from),
    durationMs: clampInt(a.durationMs ?? base.durationMs, 100, 30_000, base.durationMs),
    spread: clampNumber(a.spread ?? base.spread, 0, 1, base.spread),
    glowSize: clampInt(a.glowSize ?? base.glowSize, 4, 200, base.glowSize),
    flight: clampNumber(a.flight ?? base.flight, 0.05, 0.6, base.flight),
    overshoot: a.overshoot === true,
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
    enabled: input.enabled === true,
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
  return normalized.type === "assembly" ? normalized.assembly.durationMs : normalized.wave.durationMs;
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
    normalized.assembly.order === base.assembly.order &&
    normalized.assembly.from === base.assembly.from &&
    normalized.assembly.durationMs === base.assembly.durationMs &&
    normalized.assembly.spread === base.assembly.spread &&
    normalized.assembly.glowSize === base.assembly.glowSize &&
    normalized.assembly.flight === base.assembly.flight &&
    normalized.assembly.overshoot === base.assembly.overshoot
  );
}
