import { describe, expect, it } from "vitest";
import { resolveExportPaths } from "./resolveExportPaths";

describe("resolveExportPaths", () => {
  it("nests ascii-video under a generic components path", () => {
    const resolved = resolveExportPaths({ targetDir: "components" });
    expect(resolved.directory).toBe("components/ascii-video");
    expect(resolved.entryFileName).toBe("index.tsx");
    expect(resolved.files.entry).toBe("components/ascii-video/index.tsx");
  });

  it("does not double-nest when target already ends with ascii-video", () => {
    const resolved = resolveExportPaths({ targetDir: "src/components/ascii-video" });
    expect(resolved.directory).toBe("src/components/ascii-video");
  });

  it("uses AsciiVideo.tsx when namedFile convention is selected", () => {
    const resolved = resolveExportPaths({
      targetDir: "components",
      convention: "namedFile",
    });
    expect(resolved.files.entry).toBe("components/ascii-video/AsciiVideo.tsx");
  });

  it("uses Pascal folder naming when requested", () => {
    const resolved = resolveExportPaths({
      targetDir: "components",
      folderNaming: "pascal",
    });
    expect(resolved.directory).toBe("components/AsciiVideo");
  });

  it("throws when target directory is empty", () => {
    expect(() => resolveExportPaths({ targetDir: "  " })).toThrow(/required/i);
  });
});
