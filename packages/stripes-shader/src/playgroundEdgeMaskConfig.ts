export type PlaygroundEdgeMaskConfig = {
  /** Fade the render field out near the canvas edges, applied after all effects, before stripes. */
  enabled: boolean;
  /** Inset from each edge (0–1) where mask alpha stays 0 (content hidden). */
  start: number;
  /** Inset from each edge (0–1) where mask alpha reaches 1 (fully shown). Must be > start. */
  end: number;
  /** Curve applied to the start→end ramp (1 = linear). */
  power: number;
};

export const DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG: PlaygroundEdgeMaskConfig = {
  enabled: false,
  start: 0,
  end: 0.1,
  power: 1,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function normalizePlaygroundEdgeMaskConfig(
  input: Partial<PlaygroundEdgeMaskConfig> | undefined,
): PlaygroundEdgeMaskConfig {
  const base = DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG;
  if (!input) {
    return { ...base };
  }

  const start = clampNumber(input.start ?? base.start, 0, 0.5, base.start);
  const end = clampNumber(input.end ?? base.end, start + 0.001, 0.5, Math.max(start + 0.001, input.end ?? base.end));

  return {
    enabled: input.enabled === true,
    start,
    end,
    power: clampNumber(input.power ?? base.power, 0.1, 4, base.power),
  };
}

export function isDefaultPlaygroundEdgeMaskConfig(input: PlaygroundEdgeMaskConfig): boolean {
  const base = DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG;
  return (
    input.enabled === base.enabled && input.start === base.start && input.end === base.end && input.power === base.power
  );
}

export function resolveEdgeMaskAlpha(u: number, v: number, config: PlaygroundEdgeMaskConfig): number {
  if (!config.enabled) {
    return 1;
  }
  const start = config.start;
  const end = Math.max(config.end, start + 0.0001);
  const ramp = (inset: number) => {
    const t = Math.min(1, Math.max(0, (inset - start) / (end - start)));
    return t ** config.power;
  };
  const insetX = Math.min(u, 1 - u);
  const insetY = Math.min(v, 1 - v);
  return ramp(insetX) * ramp(insetY);
}
