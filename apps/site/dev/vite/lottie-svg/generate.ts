import fs from "node:fs";
import path from "node:path";
import { loadPalette } from "../icons/palette";
import { convertLottie } from "./convert";
import { type Registry, renderRegistry } from "./registry";

export function buildLottieSvgRegistry(dir: string, cssPath: string): Registry {
  if (!fs.existsSync(dir)) return {};

  const palette = loadPalette(cssPath);
  const registry: Registry = {};

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    registry[name] = convertLottie(name, json, palette);
  }

  return registry;
}

export function writeLottieSvgRegistry(
  registry: Registry,
  outPath: string
): boolean {
  const next = renderRegistry(registry);
  const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : "";
  if (next === prev) return false;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, next);
  return true;
}
