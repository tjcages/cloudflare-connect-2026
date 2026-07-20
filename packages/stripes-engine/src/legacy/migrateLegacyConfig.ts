/** @deprecated legacy-config shim — delete once old configs are gone */
import type { EngineConfig, Stripe } from "../config/types";
import { normalizeBackground, DEFAULT_REVEAL } from "../config/normalize";
import type { LegacyStripe, LegacyRevealConfig } from "./legacyTypes";

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
    opacity: 1,
  };
}

function migrateReveal(r: LegacyRevealConfig): EngineConfig["reveal"] {
  const w = r.wave ?? {};
  const a = r.assembly ?? {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    type: r.type === "assembly" ? "assembly" : "wave",
    wave: {
      position: (w.position as EngineConfig["reveal"]["wave"]["position"]) ?? "center",
      durationMs: typeof w.durationMs === "number" ? w.durationMs : 1200,
      softness: typeof w.softness === "number" ? w.softness : 0.22,
      waviness: typeof w.waviness === "number" ? w.waviness : 0.11,
    },
    assembly: {
      sliceSizePx: 40,
      speedMinMs: typeof a.speedMinMs === "number" ? a.speedMinMs : 300,
      speedMaxMs: typeof a.speedMaxMs === "number" ? a.speedMaxMs : 1600,
      staggerMs: typeof a.staggerMs === "number" ? a.staggerMs : 900,
      scatterPx: 50,
      angleJitterDeg: 22,
      blurPx: 8,
      blurStart: 0,
    },
    turbulence: { ...DEFAULT_REVEAL.turbulence },
    glitch: { ...DEFAULT_REVEAL.glitch },
    hadouken: { ...DEFAULT_REVEAL.hadouken },
    ink: { ...DEFAULT_REVEAL.ink },
    trace: { ...DEFAULT_REVEAL.trace },
    pulse: { ...DEFAULT_REVEAL.pulse },
  };
}

export function migrateLegacyConfig(old: unknown): Partial<EngineConfig> {
  const o = asRecord(old);
  if (!o) return {};
  const out: Partial<EngineConfig> = {};
  if (asRecord(o.textureAdjustments)) out.adjustments = o.textureAdjustments as EngineConfig["adjustments"];
  if (asRecord(o.sourceTransform)) out.transform = o.sourceTransform as EngineConfig["transform"];
  if (asRecord(o.grid)) out.grid = o.grid as EngineConfig["grid"];
  if (typeof o.backgroundColor === "number")
    out.background = normalizeBackground({ color: o.backgroundColor, transparent: false });
  if (Array.isArray(o.stripes)) out.stripes = (o.stripes as LegacyStripe[]).map(migrateStripe);
  if (typeof o.stripesEnabled === "boolean") out.stripesEnabled = o.stripesEnabled;
  if (asRecord(o.reveal)) out.reveal = migrateReveal(o.reveal as LegacyRevealConfig);
  return out;
}
