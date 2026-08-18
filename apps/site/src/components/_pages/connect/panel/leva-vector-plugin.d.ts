// StripeColorsTable reuses leva's internal vector-plugin primitives (the same
// scrubber/range widgets its own number inputs use) so the palette table's rows
// match every other leva control. leva does not export them from its public
// entry, so this mirrors the shim in `apps/lab/src/vite-env.d.ts`.
declare module "leva/dist/vector-plugin-5e122f40.esm.js" {
  import type { ComponentType } from "react";

  export const l: ComponentType<any>;
  export const q: ComponentType<any>;
  export const S: ComponentType<any>;
  export const I: ComponentType<any>;
  export function j(value: number, min: number, max: number): number;
  export function r(value: number, min: number, max: number): number;
  export function k(
    value: number,
    settings: { step: number; initialValue: number }
  ): number;
  export function e(
    handler: (state: any) => any
  ): () => Record<string, unknown>;
  export function d(category: string, key: string): string;
}
