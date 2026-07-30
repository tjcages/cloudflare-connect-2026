import type { EngineConfig } from "../config/types";

export type EdgeMaskPlacement = "none" | "field" | "output";

export function resolveEdgeMaskPlacement(config: Pick<EngineConfig, "colors" | "edgeMask">): EdgeMaskPlacement {
  if (!config.edgeMask.enabled) return "none";
  return config.colors.mode === "colors" ? "output" : "field";
}
