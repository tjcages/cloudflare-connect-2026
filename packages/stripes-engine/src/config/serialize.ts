import type { EngineConfig } from "./types";
import { normalizeEngineConfig } from "./normalize";

export function serializeEngineConfig(c: EngineConfig): string {
  return JSON.stringify(c);
}

export function parseEngineConfig(json: string): EngineConfig {
  return normalizeEngineConfig(JSON.parse(json) as Partial<EngineConfig>);
}
