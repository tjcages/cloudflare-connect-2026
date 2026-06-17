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
    expect(typesSource).not.toContain("bandDisplayP3Css");
    expect(typesSource).not.toContain("ignoreTolerance");
    expect(typesSource).toContain('"displayWidth": 848');
    expect(typesSource).toContain("stripes");
    expect(typesSource).toContain("configToStripeColors");
  });
});

describe("buildExample5ExportSnapshot", () => {
  it("uses the default stripe palette at 848×480", () => {
    const snapshot = buildExample5ExportSnapshot();
    expect(snapshot.displayWidth).toBe(848);
    expect(snapshot.stripes).toHaveLength(6);
    expect(snapshot.stripes[0]!.hex).toBe("#F3F3F3");
    expect(snapshot.stripes[5]!.hex).toBe("#EB5729");
    expect(snapshot.stripes[5]!.p3Css).toContain("display-p3");
    expect("density" in snapshot.config).toBe(false);
  });
});
