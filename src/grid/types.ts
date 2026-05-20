export const BASE_UNIT = 40;
export const SMALL_CELL_SIZE = 40;
export const LARGE_CELL_SIZE = 80;
export const STROKE_COLOR = "#F3F3F3";

export type GridCellKind = "small" | "large" | "overlaySmall";

export type GridCell = {
  id: string;
  kind: GridCellKind;
  x: number;
  y: number;
  width: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
  height: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
};

export type GapMask = boolean[][];

export type GridConfig = {
  seed: string;
  width: number;
  height: number;
  density: number;
  /** Share of large cells converted into diagonal 40×40 tips after density fill (0 = none, 1 = all-small). */
  smallCellRatio: number;
  strokeColor: string;
  gapMask: GapMask;
};

export type NormalizedGridConfig = GridConfig & {
  logicalWidth: number;
  logicalHeight: number;
  renderWidth: number;
  renderHeight: number;
  columns: number;
  rows: number;
};

export type GeneratedGrid = {
  config: NormalizedGridConfig;
  cells: GridCell[];
};

export type ComponentType = "icon-box" | "plus-marker" | "rect-marker" | "connector-line";

export type IconId =
  | "section-mark"
  | "isometric-hex"
  | "user-outline"
  | "builder-grid"
  | "builder-layers"
  | "builder-bookmark"
  | "builder-share";

import type { PaletteThemeId } from "../theme/palette";

/** Target-side line activation (sidebar): drives gray vs themed presentation from connector pulses. */
export type IconBoxEnabledByLineMode = "off" | "once" | "iterated";

export type IconBoxDirection = "horizontal" | "vertical";

export type IconBoxProps = {
  /** Number of icon slots (≥ 1). Defaults to 1 when omitted. */
  length?: number;
  /** Stack direction when length > 1. Ignored for length === 1. Defaults to horizontal. */
  direction?: IconBoxDirection;
  /** When true, corner squares use accent theme fill; when false, neutral gray. */
  matchCornersWithTheme: boolean;
  theme: PaletteThemeId;
  iconId: IconId;
  title: string;
  /** When true, draw focus reticles at the four corners of the selection frame. */
  containerHighlighted: boolean;
  /**
   * When not `off`, connector pulses gate presentation (target hits) and outgoing pulses (layer source).
   * Default `off`: always themed from `theme`.
   */
  enabledByLine: IconBoxEnabledByLineMode;
};

/** 40×40 canvas marker: centered 6×6 plus with 1px stroke; stroke color follows palette theme. */
export type PlusMarkerProps = {
  theme: PaletteThemeId;
};

/** 4×4px filled rect; center snaps to the 40px grid; drawn at instance position + 0.5px for stroke alignment. */
export type RectMarkerProps = {
  theme: PaletteThemeId;
};

export type ConnectorConnectionPreference = "horizontal" | "vertical";

export type ConnectorEndpoint =
  | {
      kind: "cell";
      /** Center point on the 80px connector lattice. */
      x: number;
      y: number;
    }
  | {
      kind: "layer";
      instanceId: string;
    };

export type ConnectorLineProps = {
  preferredConnection: ConnectorConnectionPreference;
  source: ConnectorEndpoint;
  target: ConnectorEndpoint;
  /** When true, fill large connector slice rects with white so they mask the small grid behind the stroke. */
  overlayGrid: boolean;
  /** When true, animate a themed pulse along the path and highlight bend corner **strokes** as the pulse passes. */
  animated: boolean;
};

export type ComponentProps = IconBoxProps | PlusMarkerProps | RectMarkerProps | ConnectorLineProps;

export type IconBoxInstance = {
  id: string;
  type: "icon-box";
  name: string;
  x: number;
  y: number;
  props: IconBoxProps;
};

export type PlusMarkerInstance = {
  id: string;
  type: "plus-marker";
  name: string;
  x: number;
  y: number;
  props: PlusMarkerProps;
};

export type RectMarkerInstance = {
  id: string;
  type: "rect-marker";
  name: string;
  x: number;
  y: number;
  props: RectMarkerProps;
};

export type ConnectorLineInstance = {
  id: string;
  type: "connector-line";
  name: string;
  /** Convenience source center for generic selection/position displays. */
  x: number;
  y: number;
  props: ConnectorLineProps;
};

export type ComponentInstance = IconBoxInstance | PlusMarkerInstance | RectMarkerInstance | ConnectorLineInstance;

export type CandidateCell = {
  kind: GridCellKind;
  x: number;
  y: number;
  width: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
  height: typeof SMALL_CELL_SIZE | typeof LARGE_CELL_SIZE;
};
