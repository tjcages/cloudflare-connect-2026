import fs from "node:fs";
import path from "node:path";
import { loadPalette } from "./palette";
import {
  buildRegistry,
  type Registry,
  renderAmbientDts,
  renderDts,
} from "./registry";

function writeIfChanged(filePath: string, content: string): void {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (content !== prev) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

export function generateIconRegistry(
  svgDir: string,
  cssPath: string
): Registry {
  const { registry, warnings } = buildRegistry(svgDir, loadPalette(cssPath));
  for (const w of warnings) {
    console.warn(`[icons] ${w}`);
  }
  return registry;
}

export function writeIconDts(
  registry: Registry,
  dtsPath: string,
  ambientDtsPath: string
): void {
  writeIfChanged(dtsPath, renderDts(registry));
  writeIfChanged(ambientDtsPath, renderAmbientDts());
}
