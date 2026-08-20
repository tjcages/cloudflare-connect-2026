import { describe, expect, it } from "vitest";
import {
  applyIntroPose,
  applyPoseToCard,
  applyPoseToRope,
  captureBadgePose,
  cardBottomDragOffsetY,
  hangingRope,
  INTRO_PIN,
  INTRO_POSE,
  INTRO_ROPE_POINTS,
  INTRO_TIP,
} from "./badge-intro";

describe("badge intro pose", () => {
  it("starts from a lowered hang of the captured swing, grabbed at the card bottom", () => {
    expect(INTRO_POSE.tip).toEqual(INTRO_TIP);
    expect(INTRO_POSE.tip.y).toBeLessThan(0);
    expect(INTRO_POSE.tip.x).toBe(0.0839);
    expect(INTRO_POSE.drag?.y).toBe(-0.04);
    expect(INTRO_POSE.card.ry).toBe(-0.2934);
    expect(INTRO_POSE.card.rx).toBe(-0.12);
    expect(INTRO_POSE.rope).toHaveLength(INTRO_ROPE_POINTS);
    expect(INTRO_ROPE_POINTS).toBe(5);
    expect(INTRO_POSE.rope[0]).toEqual(INTRO_TIP);
    expect(INTRO_POSE.rope.at(-1)).toEqual(INTRO_PIN);
    expect(INTRO_POSE.dragOffset.y).toBe(
      cardBottomDragOffsetY(INTRO_TIP.y, 0.158, -0.025)
    );
    expect(INTRO_POSE.dragOffset.y).toBeGreaterThan(0.1);
  });

  it("builds an unbunched hanging rope from pin to tip", () => {
    const rope = hangingRope(INTRO_TIP, INTRO_PIN, INTRO_ROPE_POINTS);
    expect(rope[0]).toEqual(INTRO_TIP);
    expect(rope.at(-1)).toEqual(INTRO_PIN);
    const mid = rope[Math.floor((INTRO_ROPE_POINTS - 1) / 2)]!;
    expect(mid.y).toBeGreaterThan(INTRO_TIP.y);
    expect(mid.y).toBeLessThan(INTRO_PIN.y);
  });

  it("places the drag grab at the bottom of the card", () => {
    expect(cardBottomDragOffsetY(0, 0.158, -0.025)).toBeCloseTo(0.183);
  });

  it("applies that hold onto the rope and card", () => {
    const rope = {
      now: INTRO_POSE.rope.map(() => ({ x: 0, y: 0, z: 0 })),
      prev: INTRO_POSE.rope.map(() => ({ x: 1, y: 1, z: 1 })),
      stretch: 0,
    };
    const card = {
      position: { x: 9, y: 9, z: 9 },
      rotation: { x: 9, y: 9, z: 9 },
    };
    applyIntroPose(rope, card);
    expect(rope.now[0]).toEqual(INTRO_POSE.tip);
    expect(rope.prev[0]).toEqual(INTRO_POSE.prev);
    expect(rope.stretch).toBe(INTRO_POSE.stretch);
    expect(card.rotation).toEqual({
      x: INTRO_POSE.card.rx,
      y: INTRO_POSE.card.ry,
      z: INTRO_POSE.card.rz,
    });
  });

  it("round-trips a dragged hold snapshot onto the rope and card", () => {
    const snapshot = captureBadgePose({
      event: "hold",
      heldMs: 2000,
      drag: { x: 0.12345, y: -0.04, z: -0.0123 },
      dragOffset: { x: 0.01, y: -0.02, z: 0 },
      hang: { x: 0.5, y: -0.2, z: 0.01 },
      card: {
        position: { x: 0, y: -0.08, z: 0.006 },
        rotation: { x: 0, y: -0.4321, z: 0.1111 },
      },
      rope: {
        now: [
          { x: 0.12, y: -0.05, z: -0.01 },
          { x: 0.06, y: 0.02, z: -0.005 },
          { x: 0, y: 0.1, z: 0 },
        ],
        prev: [{ x: 0.119, y: -0.049, z: -0.0099 }],
        stretch: 0.01234,
      },
    });
    expect(snapshot.event).toBe("hold");
    expect(snapshot.heldMs).toBe(2000);
    expect(snapshot.drag).toEqual({ x: 0.1235, y: -0.04, z: -0.0123 });
    expect(snapshot.tip).toEqual({ x: 0.12, y: -0.05, z: -0.01 });
    expect(snapshot.card.ry).toBe(-0.4321);
    expect(snapshot.rope).toHaveLength(3);

    const rope = {
      now: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      prev: [
        { x: 1, y: 1, z: 1 },
        { x: 1, y: 1, z: 1 },
        { x: 1, y: 1, z: 1 },
      ],
      stretch: 0,
    };
    const card = {
      position: { x: 9, y: 9, z: 9 },
      rotation: { x: 9, y: 9, z: 9 },
    };
    applyPoseToRope(rope, snapshot);
    applyPoseToCard(card, snapshot);
    expect(rope.now[0]).toEqual(snapshot.tip);
    expect(rope.prev[0]).toEqual(snapshot.prev);
    expect(rope.stretch).toBe(0.0123);
    expect(card.rotation.y).toBe(-0.4321);
    expect(card.position.z).toBe(0.006);
  });
});
