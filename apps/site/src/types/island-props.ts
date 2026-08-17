import type { Key } from "react";

/** Astro passes `key` as a regular prop to React islands — wrap island prop types with this. */
export type IslandProps<P = object> = P & { key?: Key };
