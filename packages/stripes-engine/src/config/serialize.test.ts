import { describe, it, expect } from "vitest";
import { serializeEngineConfig, parseEngineConfig } from "./serialize";
import { normalizeEngineConfig } from "./normalize";

describe("serialize round-trip", () => {
  it("serialize→parse yields an equal normalized config", () => {
    const c = normalizeEngineConfig({ transform: { zoom: 2 } });
    expect(parseEngineConfig(serializeEngineConfig(c))).toEqual(c);
  });
  it("parse normalizes a partial json and throws on garbage", () => {
    expect(parseEngineConfig('{"transform":{"zoom":2}}').transform.zoom).toBe(2);
    expect(() => parseEngineConfig("not json")).toThrow();
  });
});
