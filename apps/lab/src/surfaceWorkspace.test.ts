import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAB_ENGINE_CONFIG } from "./defaultLabConfig";
import {
  appendSurfacePoint,
  createSurfaceArea,
  findSurfaceAreaAtPoint,
  finishSurfaceFrame,
  finishSurfacePath,
  loadSurfaceWorkspace,
  moveSurfaceArea,
  normalizeSurfaceWorkspace,
  polygonArea,
  saveSurfaceWorkspace,
  surfaceFramePoints,
  translateSurfaceAreaPoints,
  type SurfaceArea,
} from "./surfaceWorkspace";

describe("surface workspace", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal("crypto", { randomUUID: () => "area-id" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finishes a meaningful freeform path and rejects a click", () => {
    const triangle = [
      { x: 0.1, y: 0.1 },
      { x: 0.8, y: 0.1 },
      { x: 0.4, y: 0.7 },
    ];
    expect(polygonArea(triangle)).toBeCloseTo(0.21);
    expect(finishSurfacePath(triangle)).toEqual(triangle);
    expect(finishSurfacePath([{ x: 0.2, y: 0.2 }])).toBeNull();
  });

  it("samples a drawn path without storing adjacent noise", () => {
    const first = appendSurfacePoint([], { x: 0.1, y: 0.1 });
    const ignored = appendSurfacePoint(first, { x: 0.101, y: 0.101 });
    const accepted = appendSurfacePoint(ignored, { x: 0.2, y: 0.2 });

    expect(ignored).toEqual(first);
    expect(accepted).toHaveLength(2);
  });

  it("creates canonical frames from any drag direction and rejects a click", () => {
    expect(surfaceFramePoints({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 })).toEqual([
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.1 },
      { x: 0.8, y: 0.7 },
      { x: 0.2, y: 0.7 },
    ]);
    expect(finishSurfaceFrame({ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })).toBeNull();
  });

  it("translates an area while keeping its full shape inside the canvas", () => {
    const points = [
      { x: 0.25, y: 0.125 },
      { x: 0.75, y: 0.125 },
      { x: 0.75, y: 0.625 },
    ];

    expect(translateSurfaceAreaPoints(points, { x: 0.125, y: 0.25 })).toEqual([
      { x: 0.375, y: 0.375 },
      { x: 0.875, y: 0.375 },
      { x: 0.875, y: 0.875 },
    ]);
    expect(translateSurfaceAreaPoints(points, { x: 0.5, y: -0.5 })).toEqual([
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
    ]);
  });

  it("hit-tests visible areas in layer order", () => {
    const areas = ["top", "bottom"].map(
      (id) =>
        ({
          id,
          name: id,
          kind: "freeform",
          visible: true,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.5, y: 0.9 },
          ],
          config: DEFAULT_LAB_ENGINE_CONFIG,
        }) satisfies SurfaceArea,
    );

    expect(findSurfaceAreaAtPoint(areas, { x: 0.5, y: 0.4 })?.id).toBe("top");
    expect(findSurfaceAreaAtPoint([{ ...areas[0]!, visible: false }, areas[1]!], { x: 0.5, y: 0.4 })?.id).toBe(
      "bottom",
    );
    expect(findSurfaceAreaAtPoint(areas, { x: 0, y: 0 })).toBeNull();
  });

  it("creates named areas at the top of the layer stack", () => {
    const area = createSurfaceArea(
      "freeform",
      [
        { x: 0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.4, y: 0.7 },
      ],
      DEFAULT_LAB_ENGINE_CONFIG,
      [],
    );

    expect(area).toMatchObject({ id: "area-id", name: "Area 1", visible: true });
  });

  it("creates frames with frame names", () => {
    const area = createSurfaceArea(
      "frame",
      [
        { x: 0.8, y: 0.7 },
        { x: 0.2, y: 0.1 },
      ],
      DEFAULT_LAB_ENGINE_CONFIG,
      [],
    );

    expect(area).toMatchObject({
      id: "area-id",
      name: "Frame 1",
      kind: "frame",
      points: [
        { x: 0.2, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.7 },
        { x: 0.2, y: 0.7 },
      ],
    });
  });

  it("normalizes selection and persists the workspace", () => {
    const area = {
      id: "area-1",
      name: "Hero",
      kind: "freeform",
      visible: true,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.4, y: 0.7 },
      ],
      config: DEFAULT_LAB_ENGINE_CONFIG,
    } satisfies SurfaceArea;
    const normalized = normalizeSurfaceWorkspace({
      mode: "partial",
      areas: [area],
      selectedAreaId: "missing",
      fullConfig: DEFAULT_LAB_ENGINE_CONFIG,
    });
    expect(normalized.selectedAreaId).toBe("area-1");

    saveSurfaceWorkspace(normalized);
    expect(loadSurfaceWorkspace()).toEqual(normalized);
  });

  it("loads saved areas without a kind as freeform areas", () => {
    const normalized = normalizeSurfaceWorkspace({
      mode: "partial",
      areas: [
        {
          id: "legacy-area",
          name: "Legacy",
          visible: true,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.1 },
            { x: 0.4, y: 0.7 },
          ],
          config: DEFAULT_LAB_ENGINE_CONFIG,
        },
      ],
      selectedAreaId: "legacy-area",
    });

    expect(normalized.areas[0]?.kind).toBe("freeform");
  });

  it("preserves an explicitly cleared selection", () => {
    const normalized = normalizeSurfaceWorkspace({
      mode: "partial",
      areas: [
        {
          id: "area-1",
          name: "Area 1",
          kind: "freeform",
          visible: true,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.1 },
            { x: 0.4, y: 0.7 },
          ],
          config: DEFAULT_LAB_ENGINE_CONFIG,
        },
      ],
      selectedAreaId: null,
    });

    expect(normalized.selectedAreaId).toBeNull();
  });

  it("moves layers within the visible stack order", () => {
    const areas = ["a", "b", "c"].map(
      (id) =>
        ({
          id,
          name: id,
          kind: "freeform",
          visible: true,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
          config: DEFAULT_LAB_ENGINE_CONFIG,
        }) satisfies SurfaceArea,
    );

    expect(moveSurfaceArea(areas, "b", -1).map((area) => area.id)).toEqual(["b", "a", "c"]);
    expect(moveSurfaceArea(areas, "b", 1).map((area) => area.id)).toEqual(["a", "c", "b"]);
  });
});
