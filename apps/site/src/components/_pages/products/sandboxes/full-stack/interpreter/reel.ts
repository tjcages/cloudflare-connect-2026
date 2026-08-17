import { animate } from "motion";

export const WINDOW_PITCH = 172;
export const WINDOW_SLIDE_TIME = 0.45;

const PEEK = 16;

export function createWindowReel(host: HTMLElement) {
  const track = host.querySelector<HTMLElement>("[data-interpreter-track]");
  if (!track) return null;

  const slots = Array.from(
    track.querySelectorAll<HTMLElement>("[data-interpreter-slot]")
  );
  const count = slots.length;
  if (count < 2) return null;

  let step = 0;
  let slide: ReturnType<typeof animate> | null = null;

  const offsetOf = (index: number) => {
    const row = (((index + 1 - step) % count) + count) % count;
    return (row - 1) * WINDOW_PITCH;
  };

  const commit = () => {
    slide = null;
    track.style.translate = "0px";
    for (const [index, slot] of slots.entries()) {
      slot.style.translate = `0 ${offsetOf(index)}px`;
    }
  };

  const settle = () => {
    if (!slide) return;
    slide.stop();
    commit();
  };

  return {
    centerSlot: () => slots[step % count],
    advance() {
      settle();
      step += 1;
      const wrap = slots.findIndex(
        (_, index) => offsetOf(index) === WINDOW_PITCH
      );
      let wrapped = wrap === -1;
      slide = animate(0, -WINDOW_PITCH, {
        duration: WINDOW_SLIDE_TIME,
        ease: [0.6, 0.6, 0, 1],
        onUpdate: (value) => {
          track.style.translate = `0 ${value}px`;
          if (!wrapped && value <= -PEEK) {
            wrapped = true;
            slots[wrap].style.translate = `0 ${2 * WINDOW_PITCH}px`;
          }
        },
        onComplete: commit,
      });
    },
    settle,
    destroy() {
      slide?.stop();
      slide = null;
    },
  };
}
