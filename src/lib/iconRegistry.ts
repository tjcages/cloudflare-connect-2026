import type { IconId } from "../grid/types";

export type IconDefinition = {
  id: IconId;
  label: string;
  viewBox: string;
  paths: string[];
  /** When `"stroke"`, paths are drawn with `stroke` only (source SVGs with fill none). */
  renderMode?: "fill" | "stroke";
  strokeWidth?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  /** When false, excluded from the instance icon picker (UI-only glyphs). Defaults to true. */
  pickable?: boolean;
};

export const DEFAULT_ICON_ID: IconId = "section-mark";

export const ICON_REGISTRY: IconDefinition[] = [
  {
    id: DEFAULT_ICON_ID,
    label: "Section mark",
    viewBox: "0 0 24 24",
    paths: [
      "M15.2344 3.5L20.9023 12.001L15.2363 20.5H13.4336L19.0996 12.001L13.4316 3.5H15.2344Z",
      "M15.0996 11.999L9.43359 3.5H11.2363L16.9023 11.999L11.2344 20.5H9.43164L15.0996 11.999Z",
      "M7.89648 4.80176L8.79785 6.1543L4.90039 12.001L8.79688 17.8467L7.89551 19.1992L3.09766 12.001L7.89648 4.80176Z",
    ],
  },
  {
    id: "isometric-hex",
    label: "Isometric hex",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    paths: [
      "M12.0017 1.75L20.8785 6.875M12.0017 1.75L3.125 6.875M12.0017 1.75L12.002 7M20.8785 6.875V17.125M20.8785 6.875L16.3332 9.50035M20.8785 17.125L12.0017 22.25M20.8785 17.125L16.3328 14.5005M12.0017 22.25L3.125 17.125M12.0017 22.25V12M3.125 17.125V6.875M3.125 17.125L7.67105 14.5003M3.125 6.875L7.67105 9.49967M12.0017 12L12.002 22M12.0017 12L16.3332 9.50035M12.0017 12L7.67105 9.49967M12.002 7C13.8528 7 15.4688 8.00565 16.3332 9.50035M12.002 7C10.1514 7 8.53562 8.00535 7.67105 9.49967M20.8805 6.875L16.3332 9.50035M3.12695 6.875L7.67105 9.49967M16.3328 14.5005C16.7584 13.7649 17.002 12.9109 17.002 12C17.002 11.0894 16.7585 10.2357 16.3332 9.50035M16.3328 14.5005C15.4682 15.9947 13.8525 17 12.002 17C10.1514 17 8.53562 15.9947 7.67105 14.5003M7.67105 14.5003C7.24551 13.7648 7.00195 12.9109 7.00195 12C7.00195 11.0891 7.24551 10.2352 7.67105 9.49967M16.3332 9.50035L12.0037 12L7.67105 9.49967",
    ],
  },
  {
    id: "user-outline",
    label: "User",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    paths: [
      "M4.75 20.5V19.75C4.75 15.7459 7.99594 12.5 12 12.5M12 12.5C16.0041 12.5 19.25 15.7459 19.25 19.75V20.5M12 12.5C14.4853 12.5 16.5 10.4853 16.5 8C16.5 5.51472 14.4853 3.5 12 3.5C9.51472 3.5 7.5 5.51472 7.5 8C7.5 10.4853 9.51472 12.5 12 12.5Z",
    ],
  },
  {
    id: "builder-grid",
    label: "Grid builder",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pickable: false,
    paths: ["M8 4v16", "M16 4v16", "M4 8h16", "M4 16h16"],
  },
  {
    id: "builder-layers",
    label: "Components builder",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pickable: false,
    paths: [
      "M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z",
      "m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845",
    ],
  },
  {
    id: "builder-bookmark",
    label: "Presets builder",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pickable: false,
    paths: ["m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"],
  },
  {
    id: "builder-share",
    label: "Share builder",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pickable: false,
    paths: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M16 6l-4-4-4 4", "M12 2v13"],
  },
];

export const ICON_OPTIONS = ICON_REGISTRY.filter((icon) => icon.pickable !== false).map(({ id, label }) => ({
  id,
  label,
}));

export const getIconDefinition = (iconId: IconId) =>
  ICON_REGISTRY.find((icon) => icon.id === iconId) ?? ICON_REGISTRY[0];
