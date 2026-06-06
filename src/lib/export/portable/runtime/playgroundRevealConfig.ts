import type {
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
    | (Partial<Omit<PlaygroundRevealConfig, "wave">> & {
        wave?: Partial<PlaygroundWaveRevealConfig>;
      })
    | undefined,
): PlaygroundRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  if (!input) {
    return { preset: base.preset, wave: { ...base.wave } };
  }
  const wave = input.wave ?? {};
  return {
    preset: "wave",
    wave: {
      position: WAVE_POSITIONS.has(wave.position as PlaygroundWaveRevealPosition)
        ? (wave.position as PlaygroundWaveRevealPosition)
        : base.wave.position,
      durationMs: Math.round(clampNumber(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs)),
      softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
      waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
      noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
    },
  };
}
