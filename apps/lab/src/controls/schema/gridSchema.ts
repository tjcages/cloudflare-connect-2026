import { buttonGroup } from "leva";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { drawerFolder } from "./drawerFolder";

export function buildGridFolder(args: {
  d: EngineConfig;
  shaderControlSetterRef: { current: ((values: Record<string, unknown>) => void) | null };
}) {
  const { d, shaderControlSetterRef } = args;
  return drawerFolder("Grid", {
    cellWidth: { value: d.grid.cellWidth, min: 1, max: 24, step: 1, label: "Cell width" },
    cellHeight: { value: d.grid.cellHeight, min: 1, max: 24, step: 1, label: "Cell height" },
    gapX: { value: d.grid.gapX, min: 0, max: 24, step: 0.5, label: "Gap X" },
    gapY: { value: d.grid.gapY, min: 0, max: 24, step: 0.5, label: "Gap Y" },
    cornerRadius: { value: d.grid.cornerRadius, min: 0, max: 24, step: 0.5, label: "Corner radius" },
    orientationStackMode: {
      value: d.grid.orientation,
      options: { Columns: "vertical", Rows: "horizontal" } as const,
      label: "Rotate stacks",
    },
    orientationAngleDeg: { value: d.grid.angleDeg, min: -180, max: 180, step: 1, label: "Orientation °" },
    orientationWholeRotation: { value: d.grid.rotationMode === "global", label: "Whole rotation" },
    orientationShortcuts: buttonGroup({
      label: "Shortcuts",
      opts: {
        "0°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 0 }),
        "45°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 45 }),
        "90°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 90 }),
        "135°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 135 }),
        "180°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 180 }),
      },
    }),
  });
}
