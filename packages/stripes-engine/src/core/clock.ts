export type Clock = { now(): number };
export function createRealClock(): Clock {
  return { now: () => performance.now() };
}
export type ManualClock = Clock & { set(ms: number): void; advance(dtMs: number): void };
export function createManualClock(startMs = 0): ManualClock {
  let t = startMs;
  return {
    now: () => t,
    set: (ms) => {
      t = ms;
    },
    advance: (dt) => {
      t += dt;
    },
  };
}
