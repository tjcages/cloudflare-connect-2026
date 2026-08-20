declare module "wiggle" {
  import type { Bone } from "three";

  export class WiggleBone {
    constructor(
      target: Bone,
      options?: { velocity?: number; maxStretch?: number }
    );
    update(dt?: number | null): void;
    reset(): void;
    dispose(): void;
  }
}
