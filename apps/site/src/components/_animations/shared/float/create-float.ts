const Y_AMPLITUDE = 3;
const Y_SPEED = 0.9;
const X_AMPLITUDE = 3;
const X_SPEED = 0.55;
const X_PHASE = 1.6;
const PHASE_STEP = 2.1;

export function createFloat(root: HTMLElement) {
  let targets: { el: HTMLElement; phase: number }[] = [];

  const refresh = () => {
    targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-float]")
    ).map((el, index) => ({ el, phase: index * PHASE_STEP }));
  };

  return {
    tick(t: number) {
      if (targets.length === 0) refresh();
      for (const { el, phase } of targets) {
        const y = Math.sin(t * Y_SPEED + phase) * Y_AMPLITUDE;
        const x = Math.sin(t * X_SPEED + X_PHASE + phase) * X_AMPLITUDE;
        el.style.transform = `translate(${x}px, ${y}px)`;
      }
    },
  };
}
