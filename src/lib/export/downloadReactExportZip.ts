import { strToU8, zipSync } from "fflate";
import type { ExportFile } from "./buildReactExport";

export function buildReactExportZipBlob(files: ExportFile[]): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.relativePath] = strToU8(file.content);
  }

  const bytes = zipSync(entries);
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}

export function downloadReactExportZip(files: ExportFile[], filename = "ascii-video-export.zip"): void {
  const blob = buildReactExportZipBlob(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
