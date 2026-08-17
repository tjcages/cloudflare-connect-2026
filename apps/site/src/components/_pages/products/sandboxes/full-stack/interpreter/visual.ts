import type { Visual } from "@/components/_animations/section-visuals";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
import { createTimerQueue } from "@/components/_animations/shared/choreography/timer-queue";
import { measureChips } from "@/components/_animations/shared/chips/measure-chips";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import {
  type Bullet,
  createBullet,
} from "@/components/_animations/shared/snake-pulse/bullet";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { resolveZoom } from "@/utils/zoom";
import { createWindowReel, WINDOW_SLIDE_TIME } from "./reel";

const DEEP = 4;
const BURY = 24;
const FIRST_WAIT = 0.5;
const ARRIVE_HOLD = 0.3;
const OUTPUT_ENTRANCE = 1.1;
const READ_HOLD = 1.2;
const REST_TIME = 1;

type Leg = Bullet & { startT: number };

export function createInterpreterVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const host = root.querySelector<HTMLElement>("[data-illustration-root]");
  if (!host) {
    throw new Error(
      "createInterpreterVisual: missing [data-illustration-root]"
    );
  }

  const reel = createWindowReel(host);
  const spinner = createSpinnerBridge(host, {
    ring: host.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });
  const timers = createTimerQueue();

  let leg: Leg | null = null;
  let clock = 0;

  const centerBrowser = () =>
    reel
      ?.centerSlot()
      .querySelector<HTMLElement>("[data-interpreter-browser]") ?? null;

  const loaderIn = (browser: HTMLElement | null) =>
    browser?.querySelector<HTMLElement>("[data-browser-loader]") ?? null;

  const stopLoader = (browser: HTMLElement | null) => {
    const loader = loaderIn(browser);
    if (!loader) return;
    loader.style.width = "0px";
    loader.style.opacity = "0";
  };

  const clearBrowser = (browser: HTMLElement) => {
    delete browser.dataset.active;
    delete browser.dataset.output;
    const loader = loaderIn(browser);
    if (loader) {
      loader.style.width = "";
      loader.style.opacity = "";
    }
  };

  const buildLeg = (): Leg | null => {
    const centers = measureChips(host, ["C"]);
    const track = host.querySelector<HTMLElement>("[data-interpreter-track]");
    if (!centers || !track) return null;

    const zoom = resolveZoom(host);
    const hostRect = host.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const hub = centers.C;
    const start = {
      x: hub.cx + hub.r - BURY,
      y: hub.cy,
      side: "right" as const,
    };
    const to = {
      x: (trackRect.left - hostRect.left) / zoom - DEEP,
      y: hub.cy,
      side: "left" as const,
    };
    const bullet = createBullet(
      makeSnake,
      buildConnector(start, to, { deep: DEEP, root: host }),
      "purple",
      "purple"
    );
    return { ...bullet, startT: 0 };
  };

  const retire = () => {
    const browser = centerBrowser();
    if (browser) clearBrowser(browser);
    reel?.advance();
    timers.push({ at: clock + WINDOW_SLIDE_TIME + REST_TIME, fn: throwRun });
  };

  const settleOutput = () => {
    stopLoader(centerBrowser());
    timers.push({ at: clock + READ_HOLD, fn: retire });
  };

  const reveal = () => {
    const browser = centerBrowser();
    if (browser) browser.dataset.output = "";
    timers.push({ at: clock + OUTPUT_ENTRANCE, fn: settleOutput });
  };

  const throwRun = () => {
    if (!leg) return;
    const { dwell } = leg;
    leg.startT = clock;
    leg.throw.play({
      onArrive: () => {
        const nudge = reel
          ?.centerSlot()
          .querySelector<HTMLElement>("[data-interpreter-nudge]");
        if (nudge) nudgeHit(nudge, { axis: "x", amount: 2 });

        const browser = centerBrowser();
        if (browser) browser.dataset.active = "";
        timers.push({ at: clock + dwell + ARRIVE_HOLD, fn: reveal });
      },
    });
  };

  const clearWindows = () => {
    for (const browser of host.querySelectorAll<HTMLElement>(
      "[data-interpreter-browser]"
    )) {
      clearBrowser(browser);
    }
  };

  const teardown = () => {
    leg?.snake.destroy();
    leg = null;
    timers.reset();
  };

  cleanup(() => {
    teardown();
    reel?.destroy();
  });

  return {
    tick: (elapsed, dt) => {
      clock = elapsed;

      if (!leg) {
        leg = buildLeg();
        if (!leg) return;
        timers.push({ at: clock + FIRST_WAIT, fn: throwRun });
      }

      timers.run(clock);
      leg.throw.update(clock - leg.startT);
      spinner.tick(dt);
    },
    rebuild: () => {
      teardown();
      reel?.settle();
      clearWindows();
    },
  };
}
