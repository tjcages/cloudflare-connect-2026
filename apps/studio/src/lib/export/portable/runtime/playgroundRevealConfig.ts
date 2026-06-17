import type {
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundRevealConfig,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "../types";

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

const WAVE_POSITIONS = new Set<PlaygroundWaveRevealPosition>([
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

export function normalizePlaygroundRevealConfig(
  input:
    | (Partial<Omit<PlaygroundRevealConfig, "preset" | "wave" | "randomColumns">> & {
        preset?: PlaygroundRevealConfig["preset"] | "randomColumnsShift";
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
    input.preset === "randomColumnsShift"
      ? { ...input.randomColumnsShift, ...input.randomColumns }
      : (input.randomColumns ?? {});
  return {
    preset: input.preset === "randomColumns" || input.preset === "randomColumnsShift" ? "randomColumns" : "wave",
    wave: {
      position: WAVE_POSITIONS.has(wave.position as PlaygroundWaveRevealPosition)
        ? (wave.position as PlaygroundWaveRevealPosition)
        : base.wave.position,
      durationMs: Math.round(clampNumber(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs)),
      softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
      waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
      noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
    },
    randomColumns: {
      durationMs: Math.round(
        clampNumber(
          randomColumns.durationMs ?? base.randomColumns.durationMs,
          100,
          30_000,
          base.randomColumns.durationMs,
        ),
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
