type Timer = { at: number; fn: () => void };

export function createTimerQueue() {
  let timers: Timer[] = [];

  return {
    push(timer: Timer) {
      timers.push(timer);
    },
    run(clock: number) {
      for (let i = timers.length - 1; i >= 0; i--) {
        if (clock >= timers[i].at) {
          timers[i].fn();
          timers.splice(i, 1);
        }
      }
    },
    reset() {
      timers = [];
    },
  };
}
