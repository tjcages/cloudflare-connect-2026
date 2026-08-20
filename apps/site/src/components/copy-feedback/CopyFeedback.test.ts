import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("copy feedback", () => {
  it("swaps the icon and label inside a fixed width", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/copy-feedback/CopyFeedback.tsx"),
      "utf8"
    );
    expect(source).toContain("export function CopyFeedbackIcon");
    expect(source).toContain("export function CopyFeedbackLabel");
    expect(source).toContain('mode="popLayout"');
    expect(source).toContain("invisible");
    expect(source).toContain("copyFeedbackLabelClass");
    expect(source).toContain("justify-items-start");
    expect(source).toContain("justify-items-center");
    expect(source).toContain("inline-grid");
    expect(source).toContain("size-20");
  });
});

describe("button", () => {
  it("does not morph width when copy state changes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/Button.tsx"),
      "utf8"
    );
    expect(source).not.toContain('layout="size"');
    expect(source).toContain(
      "transition-[box-shadow,background-color,color,opacity,transform]"
    );
  });
});
