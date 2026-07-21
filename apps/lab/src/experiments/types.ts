import type { StripesEngine } from "@necatikcl/stripes-engine";

export type ExperimentCategory = "trail" | "click" | "reveal" | "ambience" | "stars";

export interface ExperimentContext {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  textureUrl: string;
}

export interface ExperimentInstance {
  engine?: StripesEngine;
  replay?: () => void;
  destroy: () => void;
}

export interface ExperimentDefinition {
  id: string;
  title: string;
  category: ExperimentCategory;
  blurb: string;
  pointer?: "default" | "custom";
  create: (ctx: ExperimentContext) => ExperimentInstance;
}
