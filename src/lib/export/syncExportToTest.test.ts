import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildExample5ExportSnapshot } from "./example5Snapshot";
import { syncExportToTestProject } from "./syncExportToTest";

const TEST_ROOT = join(import.meta.dirname, "../../../../../playground/test");

describe("syncExportToTestProject", () => {
  it.runIf(process.env.SYNC_EXPORT_TEST === "1")("writes example5 bundle to playground/test", () => {
    const { written } = syncExportToTestProject(TEST_ROOT);
    expect(written.length).toBeGreaterThan(15);

    const typesPath = join(TEST_ROOT, "src/components/ascii-video/types.ts");
    const typesSource = readFileSync(typesPath, "utf8");
    expect(typesSource).toContain('"ignoreTolerance"');
    expect(typesSource).toContain('"displayWidth": 848');
    expect(typesSource).toContain("bandDisplayP3Css");
  });
});

describe("buildExample5ExportSnapshot", () => {
  it("matches catalog duotone for example5", () => {
    const snapshot = buildExample5ExportSnapshot();
    expect(snapshot.config.density).toBe(0.6);
    expect(snapshot.displayWidth).toBe(848);
    expect(snapshot.bandDisplayP3Css[4]).toContain("display-p3");
  });
});
