import {
  circleShape,
  createOrbitSnake,
} from "@/components/_animations/shared/orbit-snake/create-orbit-snake";
import {
  CENTER_SPINNER,
  ISOLATES,
  type OrbitProfile,
  TRADITIONAL,
} from "@/components/_animations/shared/orbit-snake/profiles";
import type {
  Visual,
  VisualContext,
} from "@/components/_animations/section-visuals";
import { pick, rnd } from "@/utils/random";
import { resolveZoom } from "@/utils/zoom";

const GAP = 0;
const CENTER_RADIUS = 11.5;

function circleFromRect(
  el: HTMLElement,
  containerRect: DOMRect,
  radius: number
) {
  const zoom = resolveZoom(el);
  const r = el.getBoundingClientRect();
  return circleShape(
    (r.left - containerRect.left + r.width / 2) / zoom,
    (r.top - containerRect.top + r.height / 2) / zoom,
    radius
  );
}

function centerGeometry(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-orbit-center]");
  if (!el) return null;
  return circleFromRect(el, root.getBoundingClientRect(), CENTER_RADIUS);
}

interface SideConfig {
  side: "traditional" | "isolates";
  profile: OrbitProfile;
  delay: [number, number];
  cooldown: [number, number];
  toggleActive: boolean;
  activeLeadS: number;
  concurrency?: number;
  batch?: [number, number];
}

const SIDES: SideConfig[] = [
  {
    side: "traditional",
    profile: TRADITIONAL,
    concurrency: 2,
    delay: [1.2, 3.5],
    cooldown: [1, 3],
    toggleActive: false,
    activeLeadS: 0,
  },
  {
    side: "isolates",
    profile: ISOLATES,
    batch: [1, 9],
    delay: [0.25, 1.1],
    cooldown: [0.4, 1.5],
    toggleActive: true,
    activeLeadS: 0.2,
  },
];

function geometry(el: HTMLElement, rootRect: DOMRect) {
  const r = el.getBoundingClientRect();
  return circleFromRect(el, rootRect, r.width / 2 / resolveZoom(el) + GAP);
}

export function createIsolatesVisual({
  app,
  layer,
  root,
  cleanup,
}: VisualContext): Visual {
  const clock = { t: 0 };

  const controllers = SIDES.map((cfg) => {
    const els = Array.from(
      root.querySelectorAll<HTMLElement>(`[data-orbit-side="${cfg.side}"]`)
    );
    const batch = cfg.batch;

    const circles = els.map((el) => {
      const state = {
        status: "idle" as "idle" | "active" | "cooldown",
        until: 0,
      };
      const snake = createOrbitSnake(app, {
        shape: geometry(el, root.getBoundingClientRect()),
        color: "orange",
        profile: cfg.profile,
        parent: layer,
        earlyCompleteS: cfg.activeLeadS,
        onEarlyComplete: cfg.toggleActive
          ? () => el.removeAttribute("data-active")
          : undefined,
        onComplete: batch
          ? undefined
          : () => {
              state.status = "cooldown";
              state.until = clock.t + rnd(...cfg.cooldown);
            },
      });
      return { el, snake, state };
    });

    let nextAt = rnd(...cfg.delay);

    const update = batch
      ? () => {
          if (clock.t < nextAt) return;
          const [lo, hi] = batch;
          const size = Math.min(
            circles.length,
            lo + Math.floor(Math.random() * (hi - lo + 1))
          );
          const pool = [...circles];
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          const lifetimeS = rnd(...cfg.profile.lifetime);
          for (const c of pool.slice(0, size)) {
            if (cfg.toggleActive) c.el.setAttribute("data-active", "");
            c.snake.play(lifetimeS);
          }
          nextAt = clock.t + lifetimeS + rnd(...cfg.cooldown);
        }
      : () => {
          for (const c of circles) {
            if (c.state.status === "cooldown" && clock.t >= c.state.until) {
              c.state.status = "idle";
            }
          }
          const activeCount = circles.filter(
            (c) => c.state.status === "active"
          ).length;
          if (clock.t >= nextAt && activeCount < (cfg.concurrency ?? 1)) {
            const idle = circles.filter((c) => c.state.status === "idle");
            if (idle.length) {
              const c = pick(idle);
              c.state.status = "active";
              if (cfg.toggleActive) c.el.setAttribute("data-active", "");
              c.snake.play();
            }
            nextAt = clock.t + rnd(...cfg.delay);
          }
        };

    const remeasure = () => {
      const rect = root.getBoundingClientRect();
      for (const c of circles) c.snake.setShape(geometry(c.el, rect));
    };

    return { circles, update, remeasure };
  });

  const centerGeo = centerGeometry(root);
  const centerSnake = centerGeo
    ? createOrbitSnake(app, {
        shape: centerGeo,
        color: "orange",
        profile: CENTER_SPINNER,
        parent: layer,
      })
    : null;
  centerSnake?.play();

  cleanup(() => {
    for (const ctrl of controllers) {
      for (const c of ctrl.circles) c.snake.destroy();
    }
    centerSnake?.destroy();
  });

  return {
    tick: (elapsed) => {
      clock.t = elapsed;
      for (const ctrl of controllers) ctrl.update();
    },
    rebuild: () => {
      for (const ctrl of controllers) ctrl.remeasure();
      const g = centerGeometry(root);
      if (centerSnake && g) centerSnake.setShape(g);
    },
  };
}
