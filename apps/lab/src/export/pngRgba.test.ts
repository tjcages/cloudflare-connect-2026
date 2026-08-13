import { describe, expect, it } from "vitest";
import { rgbaPngDataUri } from "./pngRgba";

describe("rgbaPngDataUri", () => {
  it("encodes a 1×1 RGBA pixel as a PNG data URI", () => {
    const uri = rgbaPngDataUri(new Uint8Array([244, 96, 33, 255]), 1, 1);
    expect(uri.startsWith("data:image/png;base64,")).toBe(true);
    const binary = atob(uri.slice("data:image/png;base64,".length));
    const png = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) png[i] = binary.charCodeAt(i);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = (png[16]! << 24) | (png[17]! << 16) | (png[18]! << 8) | png[19]!;
    const height = (png[20]! << 24) | (png[21]! << 16) | (png[22]! << 8) | png[23]!;
    expect(width).toBe(1);
    expect(height).toBe(1);
  });
});
