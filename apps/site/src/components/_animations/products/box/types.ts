import type { IconName } from "@/components/icon/icons.gen";
import type { MainColor } from "../../types";

export type IBoxCounter =
  | {
      type: "routes";
      data: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }[];
    }
  | { type: "duplicates"; count: number };

export type IProductsBox = {
  id: string;

  name: {
    text: string;
    position: "bottom" | "top";
    loud?: boolean;
  };

  icon: IconName;

  /* Size in cells, 2 means double the size. */
  size: number;

  color: MainColor;

  /** Drives the badge on the box and the hover tooltip's content. */
  counter?: IBoxCounter;

  position: {
    x: number;
    y: number;
  };

  connectTo?: string[];

  /** Draw an animated dashed connector from this box to the nearest canvas edge. */
  connectToEdge?: boolean;
};
