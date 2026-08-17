import type { SnakeFactory } from "./snake";

export type SnakeBackend = "2d" | "pixi";

export type SnakeVisualContext = {
  root: HTMLElement;
  cleanup: (fn: () => void) => void;
  makeSnake: SnakeFactory;
};

const DEFAULTS: Record<string, SnakeBackend> = {
  render: "2d",
  libraries: "2d",
  github: "2d",
  share: "2d",
  bot: "2d",
  secure: "2d",
  sandbox: "2d",
  api: "2d",
  serverless: "2d",
  run: "2d",
  deploy: "2d",
  compute: "2d",
  streaming: "2d",
};

export function backendFor(key: string): SnakeBackend {
  const fallback = DEFAULTS[key] ?? "2d";
  if (typeof location === "undefined") return fallback;

  const params = new URLSearchParams(location.search);
  const valid = (v: string | null): v is SnakeBackend =>
    v === "2d" || v === "pixi";

  const all = params.get("snakes");
  if (valid(all)) return all;

  const one = params.get(`snakes.${key}`);
  if (valid(one)) return one;

  return fallback;
}

export function splitByBackend<T>(registry: Record<string, T>): {
  canvas: Record<string, T>;
  pixi: Record<string, T>;
} {
  const canvas: Record<string, T> = {};
  const pixi: Record<string, T> = {};
  for (const [key, def] of Object.entries(registry)) {
    if (backendFor(key) === "pixi") pixi[key] = def;
    else canvas[key] = def;
  }
  return { canvas, pixi };
}
