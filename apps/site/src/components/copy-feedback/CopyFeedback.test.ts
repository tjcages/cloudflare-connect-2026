import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("copy feedback", () => {
  it("swaps the icon and label together", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/copy-feedback/CopyFeedback.tsx"),
      "utf8"
    );
    expect(source).toContain("export function CopyFeedbackIcon");
    expect(source).toContain("export function CopyFeedbackLabel");
    expect(source).toContain('mode="popLayout"');
    expect(source).toContain("whitespace-nowrap");
  });
});

describe("button layout morph", () => {
  it("animates size when icon and label swap", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/Button.tsx"),
      "utf8"
    );
    expect(source).toContain('layout="size"');
    expect(source).toContain("overflow-hidden");
    expect(source).toContain(
      "transition-[box-shadow,background-color,color,opacity,transform]"
    );
    expect(source).not.toContain("transition-all active:scale");
  });
});
