import { describe, expect, it, vi } from "vitest";
import { writeSvgToClipboard } from "./clipboard";

class MockClipboardItem {
  static supports = vi.fn(() => true);
  static instances: MockClipboardItem[] = [];

  readonly presentationStyle = "unspecified" as const;
  readonly types: string[];
  readonly items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
    this.types = Object.keys(items);
    MockClipboardItem.instances.push(this);
  }

  async getType(type: string) {
    return this.items[type];
  }
}

describe("writeSvgToClipboard", () => {
  it("writes SVG as a typed clipboard item with text fallbacks for Figma paste", async () => {
    const svg = '<svg viewBox="0 0 80 120"><path d="M0 0h80v120h-80Z" /></svg>';
    const clipboard = {
      write: vi.fn().mockResolvedValue(undefined),
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    await writeSvgToClipboard(svg, clipboard, MockClipboardItem);

    expect(clipboard.write).toHaveBeenCalledWith([MockClipboardItem.instances[0]]);
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(Object.keys(MockClipboardItem.instances[0].items)).toEqual([
      "image/svg+xml",
      "text/html",
      "text/plain",
    ]);
    await expect(MockClipboardItem.instances[0].items["image/svg+xml"].text()).resolves.toBe(svg);
    await expect(MockClipboardItem.instances[0].items["text/html"].text()).resolves.toBe(svg);
    await expect(MockClipboardItem.instances[0].items["text/plain"].text()).resolves.toBe(svg);
  });

  it("falls back to plain SVG text when rich clipboard writes are unavailable", async () => {
    const svg = '<svg viewBox="0 0 80 120"><path d="M0 0h80v120h-80Z" /></svg>';
    const clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    await writeSvgToClipboard(svg, clipboard, undefined);

    expect(clipboard.writeText).toHaveBeenCalledWith(svg);
  });
});
