import { describe, expect, it } from "vitest";
import { buildReactExportZipBlob } from "./downloadReactExportZip";
import type { ExportFile } from "./buildReactExport";

describe("downloadReactExportZip", () => {
  it("builds a non-empty zip blob with expected paths", () => {
    const files: ExportFile[] = [
      { relativePath: "src/components/ascii-video/shaders.ts", language: "typescript", content: "export {};" },
      { relativePath: "src/components/ascii-video/index.tsx", language: "typescript", content: "export {};" },
    ];

    const blob = buildReactExportZipBlob(files);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/zip");
  });
});
