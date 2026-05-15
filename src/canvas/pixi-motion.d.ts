import "pixi.js";

declare module "pixi.js" {
  interface Application {
    /** Motion `animate` (same as `import { animate } from "motion"`) after `GridCanvas` initializes. */
    animate?: (typeof import("motion"))["animate"];
  }
}
