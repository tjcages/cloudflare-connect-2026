import { animate } from "motion";
import type { IProductsBox } from "../../box/types";

export const boxNudgeX = new WeakMap<HTMLElement, number>();

export function createBoxNudge(target: IProductsBox, dir: number) {
  const box = document
    .getElementById(target.id)
    ?.querySelector<HTMLElement>("[data-box-inner]");

  return () => {
    if (!box) {
      return;
    }
    const trackX = (latest: { x?: number | string }) => {
      boxNudgeX.set(box, typeof latest.x === "number" ? latest.x : 0);
    };
    animate(
      box,
      { x: dir },
      { duration: 0.05, ease: [0.6, 0.6, 0, 1], onUpdate: trackX }
    ).then(() => {
      animate(box, { x: 0 }, { ease: [0.6, 0.6, 0, 1], onUpdate: trackX }).then(
        () => {
          boxNudgeX.set(box, 0);
        }
      );
    });
  };
}
