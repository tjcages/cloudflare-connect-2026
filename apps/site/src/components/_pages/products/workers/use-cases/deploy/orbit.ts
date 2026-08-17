const SPEED = 6;
const BASE = -24;
const QUEUE_STEP = 48;
const EXIT_AT = 55;

export function createIconOrbit(root: HTMLElement) {
  const group = root.querySelector<HTMLElement>("[data-orbit-group]");
  const chips = Array.from(
    root.querySelectorAll<HTMLElement>("[data-orbit-icon]")
  );
  const uprights = chips.map((el) =>
    el.querySelector<HTMLElement>("[data-orbit-upright]")
  );
  const offsets = uprights.map((el) => Number(el?.dataset.offset ?? 0));
  let angle = BASE;

  return {
    tick(dt: number) {
      angle += SPEED * dt;
      if (group) group.style.rotate = `${angle}deg`;
      chips.forEach((el, i) => {
        if (angle + offsets[i] > EXIT_AT) {
          offsets[i] -= QUEUE_STEP * chips.length;
          el.style.transform = `rotate(${offsets[i]}deg) translateY(-416px)`;
        }
        const upright = uprights[i];
        if (upright) upright.style.rotate = `${-(angle + offsets[i])}deg`;
      });
    },
  };
}
