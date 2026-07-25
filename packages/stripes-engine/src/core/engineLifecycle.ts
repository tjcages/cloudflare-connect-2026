export type EngineLifecycleDeps = {
  /** One iteration of the render loop, run before the next frame is armed. */
  frame: () => void;
  /** Runs just before the loop is armed, never on a redundant `start()`. */
  onStart: () => void;
  /** Release transient host-facing state (the wave trail's activity value). */
  settle: () => void;
  /** Release GPU resources. Runs on `dispose()` only. */
  teardown: () => void;
  /** False for surfaces that cannot drive rAF themselves (the worker's shared surface). */
  supportsRaf: boolean;
};

export type EngineLifecycle = {
  start(): void;
  stop(): void;
  settle(): void;
  dispose(): void;
};

/**
 * Owns the engine's rAF loop and the contract around pausing it:
 *
 * - `stop()` pauses AND settles — a paused instance reports itself at rest.
 * - `dispose()` cancels WITHOUT settling — teardown must not call back into a
 *   host that is already unmounting.
 *
 * Neither touches render state, so `start()` after `stop()` resumes rather than
 * restarting: the GL context, the source and the reveal timeline all survive.
 */
export function createEngineLifecycle(deps: EngineLifecycleDeps): EngineLifecycle {
  let rafId = 0;

  const loop = () => {
    deps.frame();
    rafId = requestAnimationFrame(loop);
  };

  const cancel = () => {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  };

  return {
    start() {
      if (!deps.supportsRaf || rafId) return;
      deps.onStart();
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      cancel();
      deps.settle();
    },
    settle() {
      deps.settle();
    },
    dispose() {
      cancel();
      deps.teardown();
    },
  };
}
