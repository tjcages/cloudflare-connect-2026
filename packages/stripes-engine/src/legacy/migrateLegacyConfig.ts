/** @deprecated legacy-config shim — delete once old configs are gone */
import type { EngineConfig, Stripe } from "../config/types";
import type { LegacyStripe } from "./legacyTypes";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function hexToNum(hex: string): number {
  return parseInt(hex.replace(/^#/, ""), 16) || 0;
}
function migrateStripe(s: LegacyStripe): Stripe {
  const color = typeof s.color === "number" ? s.color : typeof s.hex === "string" ? hexToNum(s.hex) : 0;
  return {
    color,
    startFrom: typeof s.startFrom === "number" ? s.startFrom : 0,
    width: typeof s.width === "number" ? s.width : 1,
  };
}

export function migrateLegacyConfig(old: unknown): Partial<EngineConfig> {
  const o = asRecord(old);
  if (!o) return {};
  const out: Partial<EngineConfig> = {};
  if (asRecord(o.textureAdjustments)) out.adjustments = o.textureAdjustments as EngineConfig["adjustments"];
  if (asRecord(o.sourceTransform)) out.transform = o.sourceTransform as EngineConfig["transform"];
  if (asRecord(o.grid)) out.grid = o.grid as EngineConfig["grid"];
  if (typeof o.backgroundColor === "number") out.background = { color: o.backgroundColor };
  if (Array.isArray(o.stripes)) out.stripes = (o.stripes as LegacyStripe[]).map(migrateStripe);
  if (typeof o.stripesEnabled === "boolean") out.stripesEnabled = o.stripesEnabled;
  return out;
}
