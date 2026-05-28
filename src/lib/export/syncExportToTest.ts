import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildReactExport } from "./buildReactExport";
import { buildExample5ExportSnapshot } from "./example5Snapshot";

/** Sibling repo: `code/playground/test` (not under section-grid-generator). */
const DEFAULT_TEST_ROOT = join(import.meta.dirname, "../../../../../playground/test");

export function syncExportToTestProject(testRoot = DEFAULT_TEST_ROOT): { written: string[] } {
  const snapshot = buildExample5ExportSnapshot();
  const bundle = buildReactExport(snapshot, { targetDir: "src/components" });
  const written: string[] = [];

  for (const file of bundle.files) {
    const fullPath = join(testRoot, file.relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content, "utf8");
    written.push(fullPath);
  }

  return { written };
}
