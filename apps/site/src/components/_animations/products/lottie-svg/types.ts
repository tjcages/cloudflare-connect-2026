import type { IconColor } from "@/components/icon/Icon";

export type CubicBezier = [number, number, number, number];

export interface NumberTrack {
  ease: CubicBezier[];
  times: number[];
  values: number[];
}

export interface PathTrack {
  ease: CubicBezier[];
  times: number[];
  values: string[];
}

export interface LottieSvgShape {
  d: PathTrack | string;
  fill: string | null;
  fillOpacity: number;
  fillRule: "evenodd" | "nonzero";
  opacity: number;
  stroke: string | null;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "bevel" | "miter" | "round";
  strokeMiterlimit: number;
  strokeOpacity: number;
  strokeWidth: number;
  transform: string;
}

export interface LottieSvgLayer {
  opacity: NumberTrack | number;
  rotate: NumberTrack | number;
  shapes: LottieSvgShape[];
  x: NumberTrack | number;
  y: NumberTrack | number;
}

export interface LottieSvg {
  duration: number;
  family: IconColor;
  height: number;
  layers: LottieSvgLayer[];
  width: number;
}
