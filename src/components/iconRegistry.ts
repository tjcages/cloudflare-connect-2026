import type { IconId } from "../grid/types";

export type IconDefinition = {
  id: IconId;
  label: string;
  viewBox: string;
  paths: string[];
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
];

export const ICON_OPTIONS = ICON_REGISTRY.map(({ id, label }) => ({ id, label }));

export const getIconDefinition = (iconId: IconId) =>
  ICON_REGISTRY.find((icon) => icon.id === iconId) ?? ICON_REGISTRY[0];
