import { describe, expect, it } from "vitest";
import { createManualClock } from "../core/clock";
import { createRevealClock } from "./revealClock";

const DURATION = 1470;

function setup() {
  const clock = createManualClock(1000);
  const reveal = createRevealClock(clock);
  return { clock, reveal };
}

describe("reveal clock anchoring", () => {
  it("anchors on the first read after a trigger, not on the trigger itself", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    clock.advance(5000);
    expect(reveal.elapsedMs()).toBe(0);
    clock.advance(120);
    expect(reveal.elapsedMs()).toBe(120);
  });

  it("re-anchors on a second trigger even when it lands on the same clock reading", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    expect(reveal.elapsedMs()).toBe(0);
    clock.advance(400);
    expect(reveal.elapsedMs()).toBe(400);
    reveal.trigger();
    expect(reveal.elapsedMs()).toBe(0);
  });
});

describe("reveal gate holds and resumes the reveal clock", () => {
  it("is open by default, so imperative hosts are unaffected", () => {
    const { clock, reveal } = setup();
    expect(reveal.gateOpen).toBe(true);
    reveal.trigger();
    expect(reveal.elapsedMs()).toBe(0);
    clock.advance(300);
    expect(reveal.elapsedMs()).toBe(300);
  });

  it("holds progress at zero while the gate is closed from the start", () => {
    const { clock, reveal } = setup();
    reveal.setGate(false);
    reveal.trigger();
    clock.advance(10_000);
    expect(reveal.elapsedMs()).toBe(0);
    clock.advance(10_000);
    expect(reveal.elapsedMs()).toBe(0);
  });

  it("CONTINUES rather than restarts when the gate reopens mid-reveal", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(300);
    expect(reveal.elapsedMs()).toBe(300);

    reveal.setGate(false);
    clock.advance(9000);
    expect(reveal.elapsedMs()).toBe(300);

    reveal.setGate(true);
    expect(reveal.elapsedMs()).toBe(300);
    clock.advance(200);
    expect(reveal.elapsedMs()).toBe(500);
  });

  it("survives repeated scroll-away/scroll-back without losing or replaying time", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    let expected = 0;
    for (let i = 0; i < 20; i++) {
      clock.advance(50);
      expected += 50;
      expect(reveal.elapsedMs()).toBe(expected);
      reveal.setGate(false);
      clock.advance(1234);
      expect(reveal.elapsedMs()).toBe(expected);
      reveal.setGate(true);
    }
    expect(expected).toBe(1000);
  });

  it("never runs backwards for a given trigger, whatever the gate does", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    let previous = reveal.elapsedMs();
    let open = true;
    for (let i = 0; i < 200; i++) {
      if (i % 3 === 0) {
        open = !open;
        reveal.setGate(open);
      }
      clock.advance(17);
      const next = reveal.elapsedMs();
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("a finished reveal stays finished after scrolling away and back — it never replays", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(DURATION + 10);
    expect(reveal.elapsedMs()).toBeGreaterThanOrEqual(DURATION);

    reveal.setGate(false);
    clock.advance(60_000);
    reveal.setGate(true);
    expect(reveal.elapsedMs()).toBeGreaterThanOrEqual(DURATION);
    clock.advance(16);
    expect(reveal.elapsedMs()).toBeGreaterThanOrEqual(DURATION);
  });

  it("ignores a redundant gate call, so a scroll storm cannot inflate progress", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(200);
    for (let i = 0; i < 10; i++) reveal.setGate(true);
    expect(reveal.elapsedMs()).toBe(200);
    reveal.setGate(false);
    for (let i = 0; i < 10; i++) reveal.setGate(false);
    clock.advance(500);
    expect(reveal.elapsedMs()).toBe(200);
  });

  it("starts a reveal triggered while held from zero once the gate opens", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(400);
    reveal.setGate(false);
    reveal.trigger();
    clock.advance(9000);
    expect(reveal.elapsedMs()).toBe(0);
    reveal.setGate(true);
    clock.advance(120);
    expect(reveal.elapsedMs()).toBe(120);
  });
});

describe("reveal clock animating()", () => {
  it("reports animating before the first anchored frame", () => {
    const { reveal } = setup();
    expect(reveal.animating(DURATION)).toBe(true);
  });

  it("reports animating while a reveal is in flight and stops when it completes", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(DURATION - 1);
    expect(reveal.animating(DURATION)).toBe(true);
    clock.advance(1);
    expect(reveal.animating(DURATION)).toBe(false);
  });

  it("reports at rest while held, so a paused reveal does not uncap the frame rate", () => {
    const { clock, reveal } = setup();
    reveal.trigger();
    reveal.elapsedMs();
    clock.advance(100);
    expect(reveal.animating(DURATION)).toBe(true);
    reveal.setGate(false);
    expect(reveal.animating(DURATION)).toBe(false);
    reveal.setGate(true);
    expect(reveal.animating(DURATION)).toBe(true);
  });
});
