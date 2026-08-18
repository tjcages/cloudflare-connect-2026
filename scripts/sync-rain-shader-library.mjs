/**
 * Sync the lab's GLSL shader library into the site's agenda rain overlay.
 *
 * The site cannot import from `apps/lab`, so the rain shader picker ships a
 * generated snapshot instead: every saved library entry plus the Nebula
 * default source, sorted by label. Re-run after adding/editing shaders:
 *
 *   node scripts/sync-rain-shader-library.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const savedDir = path.join(root, "apps/lab/src/shaderLibrary/saved");
const nebulaModule = path.join(root, "apps/lab/src/defaultShaderTextureSource.ts");
const outFile = path.join(
  root,
  "apps/site/src/components/_pages/connect/agenda/rain-shader-library.json",
);

const entries = [];
for (const file of await readdir(savedDir)) {
  if (!file.endsWith(".json")) continue;
  const parsed = JSON.parse(await readFile(path.join(savedDir, file), "utf8"));
  const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
  const label = typeof parsed.label === "string" ? parsed.label.trim() : "";
  const source = typeof parsed.source === "string" ? parsed.source : "";
  if (!id || !label || !source.trim()) continue;
  entries.push({ id, label, source });
}

// Nebula ships as a template-literal TS module; lift the literal body.
const nebulaTs = await readFile(nebulaModule, "utf8");
const nebulaMatch = nebulaTs.match(/`([\s\S]*)`/);
if (nebulaMatch) {
  entries.push({ id: "nebula", label: "Nebula (default)", source: nebulaMatch[1] });
}

entries.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
await writeFile(outFile, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Wrote ${entries.length} shaders to ${path.relative(root, outFile)}`);
