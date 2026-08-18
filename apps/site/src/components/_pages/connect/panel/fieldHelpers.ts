import type { PanelField } from "@tjcages/panels/dev";
import { COLOR_LIBRARY } from "./colorLibrary";
import type { PanelValues } from "./panelSections";

/** Slider field — same (label, min, max, step) tuples the leva schemas used. */
export const num = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number
): PanelField<PanelValues> => ({ type: "slider", key, label, min, max, step });

export const toggle = (
  key: string,
  label: string
): PanelField<PanelValues> => ({
  type: "toggle",
  key,
  label,
});

/** Select field from a leva-style `{ label: value }` options record. */
export const select = (
  key: string,
  label: string,
  options: Record<string, string>
): PanelField<PanelValues> => ({
  type: "select",
  key,
  label,
  options: Object.entries(options).map(([optionLabel, value]) => ({
    label: optionLabel,
    value,
  })),
});

/** Library color field — swatch + token display backed by the site palette. */
export const color = (key: string, label: string): PanelField<PanelValues> => ({
  type: "color",
  key,
  label,
  library: COLOR_LIBRARY,
});

/** `camelCase` mode ids → display labels, matching the leva `optionsFrom`. */
export const optionsFrom = (values: string[]): Record<string, string> =>
  Object.fromEntries(
    values.map((value) => [
      value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value,
    ])
  );
