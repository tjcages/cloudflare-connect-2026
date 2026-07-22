import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type TimeTransportController = {
  getTime: () => number;
  isPlaying: () => boolean;
  toggle: () => void;
  step: (seconds: number) => void;
  reset: () => void;
};

export function transportRepeatDelayMs(heldMs: number): number {
  if (heldMs < 900) return 170;
  if (heldMs < 1800) return 100;
  return 55;
}

export function steppedTransportTime(currentSeconds: number, stepSeconds: number): number {
  return Math.max(0, currentSeconds + stepSeconds);
}

export function TimeTransport({ controller }: { controller: TimeTransportController }) {
  const [snapshot, setSnapshot] = useState(() => ({ time: controller.getTime(), playing: controller.isPlaying() }));
  const repeatTimerRef = useRef<number | null>(null);
  const holdStartedAtRef = useRef(0);

  const refresh = useCallback(() => {
    setSnapshot({ time: controller.getTime(), playing: controller.isPlaying() });
  }, [controller]);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current !== null) window.clearTimeout(repeatTimerRef.current);
    repeatTimerRef.current = null;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 80);
    return () => {
      window.clearInterval(timer);
      stopRepeat();
    };
  }, [refresh, stopRepeat]);

  const beginRepeat = (event: ReactPointerEvent<HTMLButtonElement>, seconds: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopRepeat();
    controller.step(seconds);
    refresh();
    holdStartedAtRef.current = performance.now();

    const repeat = () => {
      controller.step(seconds);
      refresh();
      repeatTimerRef.current = window.setTimeout(
        repeat,
        transportRepeatDelayMs(performance.now() - holdStartedAtRef.current),
      );
    };
    repeatTimerRef.current = window.setTimeout(repeat, 360);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const keyboardStep = (event: React.MouseEvent<HTMLButtonElement>, seconds: number) => {
    if (event.detail !== 0) return;
    controller.step(seconds);
    refresh();
  };

  return (
    <div className="time-transport">
      <output className="time-transport-readout" aria-live="off">
        {snapshot.time.toFixed(2)}s
      </output>
      <div className="time-transport-buttons">
        <button
          type="button"
          className="time-transport-step"
          aria-label="Rewind one second; hold to continue rewinding"
          title="Rewind 1 second · hold to scrub"
          onPointerDown={(event) => beginRepeat(event, -1)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onLostPointerCapture={stopRepeat}
          onClick={(event) => keyboardStep(event, -1)}
        >
          −1s
        </button>
        <button
          type="button"
          className="time-transport-play"
          aria-label={snapshot.playing ? "Pause" : "Play"}
          title={snapshot.playing ? "Pause" : "Play"}
          onClick={() => {
            controller.toggle();
            refresh();
          }}
        >
          {snapshot.playing ? "Ⅱ" : "▶"}
        </button>
        <button
          type="button"
          className="time-transport-step"
          aria-label="Advance one second; hold to continue advancing"
          title="Advance 1 second · hold to scrub"
          onPointerDown={(event) => beginRepeat(event, 1)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onLostPointerCapture={stopRepeat}
          onClick={(event) => keyboardStep(event, 1)}
        >
          +1s
        </button>
        <button
          type="button"
          className="time-transport-reset"
          onClick={() => {
            controller.reset();
            refresh();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
