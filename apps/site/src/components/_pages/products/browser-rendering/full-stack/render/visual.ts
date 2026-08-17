import { cubicBezier } from "motion";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { Anchor } from "@/components/_animations/shared/snake-pulse/geometry";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type { ThrowableSnake } from "@/components/_animations/shared/snake-pulse/snake";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { resolveZoom } from "@/utils/zoom";

const STEP = 188;
const SLIDE = 0.3375;
const HOLD = 0.15;
const RETURN_EXIT_DURATION = 0.15;
const DEACTIVATE_DELAY = 0.15;
const SLIDE_DELAY = 0.15;
const REST = 0.5;
const CENTER_SLOT = 1;
const MIN_SPAN = 4;
const EASE = cubicBezier(0.6, 0.6, 0, 1);

type Conn = { snake: ThrowableSnake; throw: PulseThrow };
type Conns = { down: Conn; up: Conn };
type Anchors = {
  from: Anchor;
  to: Anchor;
  downArrive: number;
  upArrive: number;
};
type Phase =
  | "rest"
  | "down"
  | "hold"
  | "up"
  | "deactivate-delay"
  | "slide-delay"
  | "slide";

const anchorKey = ({ from, to }: Anchors) =>
  [from.x, from.y, to.x, to.y].map((n) => n.toFixed(1)).join(":");

export function createRenderVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const row = root.querySelector<HTMLElement>("[data-render-row]");
  const pill = root.querySelector<HTMLElement>('[data-chip-id="pill"]');
  const slots = row?.children.length ?? 0;

  let conns: Conns | null = null;
  let builtKey = "";
  let centerIdx = CENTER_SLOT;
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let live: Conn | null = null;
  let shotAt = 0;
  let slideAt = 0;
  let clock = 0;

  const boxEl = () =>
    root.querySelector<HTMLElement>(`[data-chip-id="box-${centerIdx}"]`);

  const measure = (box: HTMLElement): Anchors | null => {
    if (!pill) return null;
    const zoom = resolveZoom(root);
    const cr = root.getBoundingClientRect();
    const pr = pill.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const pillEdge = (pr.bottom - cr.top) / zoom;
    const boxEdge = (br.top - cr.top) / zoom;
    if (!(boxEdge - pillEdge >= MIN_SPAN)) return null;
    const from = {
      x: (pr.left + pr.width / 2 - cr.left) / zoom,
      y: (pr.top + pr.height / 2 - cr.top) / zoom,
      side: "left" as const,
    };
    const to = {
      x: (br.left + br.width / 2 - cr.left) / zoom,
      y: (br.top + br.height / 2 - cr.top) / zoom,
      side: "left" as const,
    };
    const span = to.y - from.y;
    if (span <= 0) return null;
    return {
      from,
      to,
      downArrive: (boxEdge - from.y) / span,
      upArrive: (to.y - pillEdge) / span,
    };
  };

  const connect = (
    from: Anchor,
    to: Anchor,
    arrive: number,
    exitDuration?: number
  ): Conn =>
    createBullet(
      makeSnake,
      buildConnector(from, to, { deep: 0, root }),
      "orange",
      "orange",
      { arrive, exitDuration }
    );

  const destroyConns = () => {
    if (conns) {
      for (const conn of [conns.down, conns.up]) {
        conn.snake.destroy();
      }
    }
    conns = null;
    builtKey = "";
    live = null;
  };

  cleanup(destroyConns);

  const ensureConns = (box: HTMLElement): Conns | null => {
    const anchors = measure(box);
    if (!anchors) {
      destroyConns();
      return null;
    }
    const key = anchorKey(anchors);
    if (conns && key === builtKey) return conns;
    destroyConns();
    builtKey = key;
    conns = {
      down: connect(anchors.from, anchors.to, anchors.downArrive),
      up: connect(
        anchors.to,
        anchors.from,
        anchors.upArrive,
        RETURN_EXIT_DURATION
      ),
    };
    return conns;
  };

  const clearActive = () => {
    if (!row) return;
    for (const el of Array.from(row.children)) {
      el.removeAttribute("data-active");
    }
  };

  const rest = () => {
    phase = "rest";
    phaseUntil = clock + REST;
    live = null;
  };

  const startDown = () => {
    const box = boxEl();
    const ready = box ? ensureConns(box) : null;
    if (!box || !ready) {
      rest();
      return;
    }
    phase = "down";
    shotAt = clock;
    live = ready.down;
    ready.down.throw.play({
      onArrive: () => {
        clearActive();
        box.setAttribute("data-active", "true");
        nudgeHit(box, { axis: "y", amount: 1.5 });
      },
    });
  };

  const startUp = () => {
    if (!conns) {
      rest();
      return;
    }
    phase = "up";
    shotAt = clock;
    live = conns.up;
    conns.up.throw.play({
      onArrive: () => {
        if (pill) nudgeHit(pill, { axis: "y", amount: -1.5 });
      },
    });
  };

  const startSlide = () => {
    phase = "slide";
    slideAt = clock;
    live = null;
  };

  const endSlide = () => {
    if (!row) return;
    const first = row.firstElementChild as HTMLElement | null;
    if (first) row.appendChild(first);
    row.style.transform = "";
    if (slots > 0) centerIdx = (centerIdx + 1) % slots;
    clearActive();
  };

  const rebuild = () => {
    destroyConns();
    if (row) row.style.transform = "";
    clearActive();
    rest();
  };

  return {
    tick: (elapsed) => {
      clock = elapsed;
      if (!row || !pill) return;

      if (phase === "rest") {
        if (clock >= phaseUntil) startDown();
        return;
      }

      if (phase === "hold") {
        if (clock >= phaseUntil) startUp();
        return;
      }

      if (phase === "deactivate-delay") {
        if (clock >= phaseUntil) {
          clearActive();
          phase = "slide-delay";
          phaseUntil = clock + SLIDE_DELAY;
        }
        return;
      }

      if (phase === "slide-delay") {
        if (clock >= phaseUntil) startSlide();
        return;
      }

      if (phase === "slide") {
        const progress = Math.min((clock - slideAt) / SLIDE, 1);
        if (progress < 1) {
          const eased = EASE(progress);
          row.style.transform = `translateX(${-STEP * eased}px)`;
          return;
        }
        endSlide();
        rest();
        return;
      }

      if (!live) {
        rest();
        return;
      }

      live.throw.update(clock - shotAt);
      if (!live.throw.done) return;

      if (phase === "down") {
        phase = "hold";
        phaseUntil = clock + HOLD;
        return;
      }

      phase = "deactivate-delay";
      phaseUntil = clock + DEACTIVATE_DELAY;
      live = null;
    },
    rebuild,
  };
}
