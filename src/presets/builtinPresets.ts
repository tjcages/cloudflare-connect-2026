import type { ComponentInstance } from "../grid/types";
import { DEFAULT_CONFIG } from "../grid/config";

export type BuiltinPreset = {
  id: string;
  label: string;
  /** Inner zustand `partialize` document slice (not the `{ state, version }` envelope). */
  snapshot: {
    gridConfig: typeof DEFAULT_CONFIG;
    instances: ComponentInstance[];
    nextInstanceIndex: number;
    selectedInstanceId: string | null;
    canvasPan: { x: number; y: number };
  };
};

/**
 * "Crowded" = higher grid density; three palette themes across icon boxes; mixed 2×1 and 1×1 icon boxes.
 */
const crowdedThreeColors2x1And1x1: BuiltinPreset["snapshot"] = {
  gridConfig: {
    ...DEFAULT_CONFIG,
    seed: "preset-crowded-3c",
    density: 0.52,
  },
  instances: [
    {
      id: "icon-box-2x1-1",
      type: "icon-box-2x1",
      name: "Icon Box 2x1 1",
      x: 80,
      y: 120,
      props: {
        matchCornersWithTheme: true,
        theme: "blue",
        iconId: "section-mark",
        title: "Blue 2x1",
        containerHighlighted: false,
        enabledByLine: "off",
      },
    },
    {
      id: "icon-box-2",
      type: "icon-box",
      name: "Icon Box 2",
      x: 320,
      y: 120,
      props: {
        matchCornersWithTheme: true,
        theme: "orange",
        iconId: "isometric-hex",
        title: "Orange 1x1",
        containerHighlighted: false,
        enabledByLine: "off",
      },
    },
    {
      id: "icon-box-3",
      type: "icon-box",
      name: "Icon Box 3",
      x: 400,
      y: 240,
      props: {
        matchCornersWithTheme: true,
        theme: "purple",
        iconId: "user-outline",
        title: "Purple 1x1",
        containerHighlighted: false,
        enabledByLine: "off",
      },
    },
  ],
  nextInstanceIndex: 18,
  selectedInstanceId: null,
  canvasPan: { x: 0, y: 0 },
};

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    id: "crowded-3-colors-2x1-1x1",
    label: "Crowded, 3 colors, 2x1, 1x1",
    snapshot: crowdedThreeColors2x1And1x1,
  },
];
