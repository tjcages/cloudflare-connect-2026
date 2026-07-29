import type { EngineConfig } from "./types";
import { normalizeEngineConfig } from "./normalize";

export type ThemeName = "light" | "dark";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ThemedEngineConfig = DeepPartial<EngineConfig> & { dark?: DeepPartial<EngineConfig> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(value) ? deepMerge(prev, value) : value;
  }
  return out;
}

function deepDiff(base: Record<string, unknown>, edited: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edited)) {
    const prev = base[key];
    if (isPlainObject(prev) && isPlainObject(value)) {
      const nested = deepDiff(prev, value);
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    if (Array.isArray(prev) && Array.isArray(value)) {
      if (JSON.stringify(prev) !== JSON.stringify(value))
        out[key] = value.map((v) => (isPlainObject(v) ? { ...v } : v));
      continue;
    }
    if (!Object.is(prev, value)) out[key] = value;
  }
  return out;
}

export function resolveThemedConfig(config: ThemedEngineConfig, theme: ThemeName = "light"): Partial<EngineConfig> {
  const { dark, ...light } = config;
  if (theme !== "dark" || !dark) return light as Partial<EngineConfig>;
  return deepMerge(light, dark as Record<string, unknown>) as Partial<EngineConfig>;
}

export function diffEngineConfig(base: EngineConfig, edited: EngineConfig): DeepPartial<EngineConfig> {
  return deepDiff(base as unknown as Record<string, unknown>, edited as unknown as Record<string, unknown>);
}

export function sanitizeThemedConfig(input: ThemedEngineConfig): ThemedEngineConfig {
  const base = normalizeEngineConfig(resolveThemedConfig(input, "light"));
  if (!input.dark) return base;
  const dark = diffEngineConfig(base, normalizeEngineConfig(resolveThemedConfig(input, "dark")));
  return Object.keys(dark).length > 0 ? { ...base, dark } : base;
}
