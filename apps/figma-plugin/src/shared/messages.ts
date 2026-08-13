import type { EngineConfig } from "@necatikcl/stripes-engine";

export const CONFIG_PLUGIN_DATA_KEY = "connect-shader-config-v1";

export type InsertMetadata = {
  config: EngineConfig;
  outputWidth: number;
  outputHeight: number;
  sourceName: string;
};

export type UiToPluginMessage =
  | { type: "request-selection-image" }
  | { type: "insert-svg"; svg: string; metadata: InsertMetadata }
  | { type: "insert-png"; bytes: Uint8Array; metadata: InsertMetadata };

export type PluginToUiMessage =
  | { type: "selection-image"; bytes: Uint8Array; name: string }
  | { type: "selection-error"; message: string }
  | { type: "insert-complete"; format: "SVG" | "PNG"; nodeName: string }
  | { type: "insert-error"; message: string };

export function encodeMetadata(metadata: InsertMetadata): string {
  return JSON.stringify(metadata);
}

export function isValidOutputSize(width: number, height: number): boolean {
  return (
    Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1 && width <= 4096 && height <= 4096
  );
}
