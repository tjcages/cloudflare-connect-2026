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
    id: "api",
    label: "Api",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    strokeLinecap: "round",
    paths: [
      "M8.25 13.25C6.17893 13.25 4.5 11.5711 4.5 9.5C4.5 7.60044 5.91237 6.03077 7.74426 5.78381C8.35237 4.01838 10.0281 2.75 12 2.75C14.4853 2.75 16.5 4.76472 16.5 7.25C18.1569 7.25 19.5 8.59315 19.5 10.25C19.5 11.9069 18.1569 13.25 16.5 13.25H8.25Z",
      "M12 21.25C13.3807 21.25 14.5 20.1307 14.5 18.75C14.5 17.3693 13.3807 16.25 12 16.25C10.6193 16.25 9.5 17.3693 9.5 18.75C9.5 20.1307 10.6193 21.25 12 21.25Z",
      "M9.5 18.75H2.75",
      "M21.25 18.75H14.5",
      "M12 16V13",
    ],
  },
  {
    id: "kv",
    label: "KV",
    viewBox: "0 0 24 24",
    renderMode: "stroke",
    strokeWidth: 1.25,
    paths: [
      "M19.25 13.9306C19.25 14.7471 18.1754 15.4746 16.5 15.9453M4.75 13.9306C4.75 14.8257 6.04145 15.6138 8 16.0739M8 16.0739C9.14649 16.3432 10.5216 16.5 12 16.5C13.7002 16.5 15.2637 16.2926 16.5 15.9453M8 16.0739V20.8239M16.5 11.6953C18.1754 11.2246 19.25 10.4971 19.25 9.68056V18.6806C19.25 20.0996 16.0041 21.25 12 21.25C10.5216 21.25 9.14649 21.0932 8 20.8239C6.04145 20.3638 4.75 19.5757 4.75 18.6806V9.68056C4.75 11.0996 7.99594 12.25 12 12.25C13.7002 12.25 15.2637 12.0426 16.5 11.6953ZM16.5 11.6953V15.9453",
      "M12 12.25C16.0041 12.25 19.25 11.0996 19.25 9.68056V5.31944M12 12.25C7.99594 12.25 4.75 11.0996 4.75 9.68056V5.31944M12 12.25V7.88889M19.25 5.31944C19.25 6.73851 16.0041 7.88889 12 7.88889M19.25 5.31944C19.25 3.90038 16.0041 2.75 12 2.75C7.99594 2.75 4.75 3.90038 4.75 5.31944M12 7.88889C7.99594 7.88889 4.75 6.73851 4.75 5.31944",
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
    label: "Export state builder",
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
