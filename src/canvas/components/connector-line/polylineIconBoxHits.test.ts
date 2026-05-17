import { describe, expect, it } from "vitest";
import { createComponentInstance, getInstanceCanvasBounds } from "../../../lib/componentRegistry";
import { getPolylineMetrics, pointAlongPolyline } from "./pathMotion";
import {
  ICON_BOX_HIT_PARTICLE_INNER_INSET_PX,
  collectIconBoxHitsAlongConnector,
  resolveIconBoxLiveParticleEmit,
} from "./polylineIconBoxHits";

describe("collectIconBoxHitsAlongConnector", () => {
  it("computes forward/backward arcs for a horizontal crossing", () => {
    const box = createComponentInstance("icon-box", 200, 220, 1, 4000, 4000);
    const canvasBounds = getInstanceCanvasBounds(box);
    const midY = canvasBounds.y + canvasBounds.height / 2;

    const points = [
      { x: canvasBounds.x - 80, y: midY },
      { x: canvasBounds.x + canvasBounds.width + 120, y: midY },
    ];
    const metrics = getPolylineMetrics(points);
    const hits = collectIconBoxHitsAlongConnector(points, metrics, [box]);

    expect(hits).toHaveLength(1);
    const hit = hits[0];
    expect(hit.boxId).toBe(box.id);

    const enterDist = canvasBounds.x - points[0].x;
    const exitDist = canvasBounds.x + canvasBounds.width - points[0].x;

    expect(hit.forwardArc).toBeCloseTo(enterDist);
    expect(hit.backwardArc).toBeCloseTo(exitDist);

    expect(pointAlongPolyline(points, metrics, hit.forwardArc).x).toBeCloseTo(canvasBounds.x);
    expect(pointAlongPolyline(points, metrics, hit.forwardArc).y).toBeCloseTo(midY);
    expect(pointAlongPolyline(points, metrics, hit.backwardArc).x).toBeCloseTo(canvasBounds.x + canvasBounds.width);
    expect(pointAlongPolyline(points, metrics, hit.backwardArc).y).toBeCloseTo(midY);

    /** West face: pulse enters along +X; inner body recoils ~+X. Emitter anchored on crossed left edge. */
    expect(hit.pushForwardX).toBeCloseTo(1);
    expect(hit.pushForwardY).toBeCloseTo(0);
    expect(hit.emitterForward.x).toBeCloseTo(canvasBounds.x);
    expect(hit.emitterForward.y).toBeCloseTo(midY);
    expect(hit.particleEmitForward.x).toBeCloseTo(canvasBounds.x + ICON_BOX_HIT_PARTICLE_INNER_INSET_PX);
    expect(hit.particleEmitForward.y).toBeCloseTo(midY);
  });

  it("computes arcs for a vertical crossing", () => {
    const box = createComponentInstance("icon-box", 160, 180, 2, 4000, 4000);
    const canvasBounds = getInstanceCanvasBounds(box);
    const midX = canvasBounds.x + canvasBounds.width / 2;

    const points = [
      { x: midX, y: canvasBounds.y - 60 },
      { x: midX, y: canvasBounds.y + canvasBounds.height + 90 },
    ];
    const metrics = getPolylineMetrics(points);
    const hits = collectIconBoxHitsAlongConnector(points, metrics, [box]);

    expect(hits).toHaveLength(1);
    const hit = hits[0];

    const enterDist = canvasBounds.y - points[0].y;
    const exitDist = canvasBounds.y + canvasBounds.height - points[0].y;

    expect(hit.forwardArc).toBeCloseTo(enterDist);
    expect(hit.backwardArc).toBeCloseTo(exitDist);

    /** Top face: downward pulse (+Y inward); recoils ~+Y. Emitter on crossed top edge. */
    expect(hit.pushForwardX).toBeCloseTo(0);
    expect(hit.pushForwardY).toBeCloseTo(1);
    expect(hit.emitterForward.x).toBeCloseTo(midX);
    expect(hit.emitterForward.y).toBeCloseTo(canvasBounds.y);
    expect(hit.particleEmitForward.x).toBeCloseTo(midX);
    expect(hit.particleEmitForward.y).toBeCloseTo(canvasBounds.y + ICON_BOX_HIT_PARTICLE_INNER_INSET_PX);
  });

  it("resolveIconBoxLiveParticleEmit tracks the box after it moves", () => {
    const box = createComponentInstance("icon-box", 200, 220, 1, 4000, 4000);
    let canvasBounds = getInstanceCanvasBounds(box);
    const midY = canvasBounds.y + canvasBounds.height / 2;

    const points = [
      { x: canvasBounds.x - 80, y: midY },
      { x: canvasBounds.x + canvasBounds.width + 120, y: midY },
    ];
    const metrics = getPolylineMetrics(points);
    const hits = collectIconBoxHitsAlongConnector(points, metrics, [box]);
    const hit = hits[0];
    expect(hit).toBeDefined();

    const shifted = { ...box, x: box.x + 55 };
    canvasBounds = getInstanceCanvasBounds(shifted);
    const rect = {
      x: canvasBounds.x,
      y: canvasBounds.y,
      width: canvasBounds.width,
      height: canvasBounds.height,
    };

    const live = resolveIconBoxLiveParticleEmit(points, metrics, rect, "forward");
    expect(live).not.toBeNull();
    expect(live!.x).toBeCloseTo(hit!.particleEmitForward.x + 55);
    expect(live!.y).toBeCloseTo(hit!.particleEmitForward.y);
  });

  it("returns empty when the polyline misses the shadow card", () => {
    const box = createComponentInstance("icon-box", 300, 300, 3, 4000, 4000);
    const canvasBounds = getInstanceCanvasBounds(box);
    const yMiss = canvasBounds.y + canvasBounds.height + 50;

    const points = [
      { x: canvasBounds.x - 40, y: yMiss },
      { x: canvasBounds.x + canvasBounds.width + 40, y: yMiss },
    ];
    const metrics = getPolylineMetrics(points);
    const hits = collectIconBoxHitsAlongConnector(points, metrics, [box]);

    expect(hits).toHaveLength(0);
  });
});
