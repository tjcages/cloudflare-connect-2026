/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyStripe = { hex?: string; color?: number; startFrom?: number; width?: number };
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyConfig = Record<string, unknown>;
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyRevealAssembly = { speedMinMs?: number; speedMaxMs?: number; staggerMs?: number };
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyRevealWave = {
  position?: string;
  durationMs?: number;
  softness?: number;
  waviness?: number;
  noiseScale?: number;
};
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyRevealConfig = {
  enabled?: boolean;
  type?: string;
  wave?: LegacyRevealWave;
  assembly?: LegacyRevealAssembly;
};
