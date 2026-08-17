import { cubicBezier } from "motion";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { pick, rnd } from "@/utils/random";
import { resolveZoom } from "@/utils/zoom";

const SIZES = { cf: 56, bot: 40 };
const WINDOW_W = 208;
const WINDOW_H = 136;
const BARRIER_H = 40;
const SPEEDS = { cf: 175, bot: 131.25 };
const CF_RATIO = 0.1;
const MARGIN = 84;
const SPAWN_MIN = 0.6;
const SPAWN_MAX = 1;
const RISE = 0.18;
const HOLD = 0;
const FADE = 0.3;
const DISSOLVE = 1.125;
const CAUGHT_HOLD = 0;
const KNOCKBACK = 14;
const KNOCK_TIME = 1;
const EASE_OUT = cubicBezier(0.165, 0.84, 0.44, 1);
const TRAVEL_EASE = cubicBezier(0.32, 0, 0.67, 0);
const DISSOLVE_EASE = cubicBezier(0.6, 0.6, 0, 1);

type Kind = keyof typeof SIZES;

type Badge = {
  el: HTMLElement;
  kind: Kind;
  size: number;
  spawnX: number;
  spawnY: number;
  travelX: number;
  travelY: number;
  unitX: number;
  unitY: number;
  duration: number;
  impact: number;
  impactAngle: number;
  x: number;
  y: number;
  startT: number;
  stoppedAt: number;
};

export function createBotVisual({ root, cleanup }: SnakeVisualContext): Visual {
  const field = root.querySelector<HTMLElement>("[data-bot-field]");
  const barrier = root.querySelector<HTMLElement>("[data-bot-barrier]");
  const glow = root.querySelector<HTMLElement>("[data-bot-glow]");
  const bar = root.querySelector<HTMLElement>("[data-bot-bar]");
  const browser = root.querySelector<HTMLElement>("[data-bot-browser]");
  const templates: Record<Kind, HTMLTemplateElement | null> = {
    cf: root.querySelector('[data-bot-template="cf"]'),
    bot: root.querySelector('[data-bot-template="bot"]'),
  };

  let badges: Badge[] = [];
  let stageW = 0;
  let stageH = 0;
  let nextSpawnAt = 0;
  let flashAt = -1;
  let lastKind: Kind | null = null;
  let lastDirection: number | null = null;
  let clock = 0;

  const measure = () => {
    const zoom = resolveZoom(root);
    const cr = root.getBoundingClientRect();
    stageW = cr.width / zoom;
    stageH = cr.height / zoom;
  };

  const resetBarrier = () => {
    flashAt = -1;
    if (bar) {
      bar.style.scale = "";
      bar.style.opacity = "";
    }
    if (glow) glow.style.opacity = "";
    if (barrier) {
      barrier.style.translate = "";
      barrier.style.rotate = "";
    }
  };

  const clearBadges = () => {
    for (const badge of badges) badge.el.remove();
    badges = [];
  };

  const nextDirection = () => {
    const options = [0, 1, 2, 3].filter((dir) => dir !== lastDirection);
    return pick(options);
  };

  const spawn = (kind: Kind) => {
    const template = templates[kind];
    const el = template?.content.firstElementChild?.cloneNode(true);
    if (!field || !(el instanceof HTMLElement)) return;

    const size = SIZES[kind];
    const half = size / 2;
    const centerX = stageW / 2;
    const centerY = stageH / 2;
    const direction = nextDirection();
    const horizontal = direction === 0 || direction === 1;
    const offsetMax = (horizontal ? WINDOW_H / 2 : WINDOW_W / 2) - half;
    const offset = rnd(-offsetMax, offsetMax);
    const spawnX = horizontal
      ? direction === 0
        ? stageW + MARGIN
        : -MARGIN
      : centerX + offset;
    const spawnY = horizontal
      ? centerY + offset
      : direction === 2
        ? stageH + MARGIN
        : -MARGIN;
    const travelX = horizontal ? centerX - spawnX : 0;
    const travelY = horizontal ? 0 : centerY - spawnY;
    const distance = Math.hypot(travelX, travelY);

    let impact = 1;
    let impactAngle = 0;
    if (kind === "bot") {
      const boundX = WINDOW_W / 2 + half;
      const boundY = WINDOW_H / 2 + half;
      const enterX =
        travelX === 0
          ? -Infinity
          : (centerX - Math.sign(travelX) * boundX - spawnX) / travelX;
      const enterY =
        travelY === 0
          ? -Infinity
          : (centerY - Math.sign(travelY) * boundY - spawnY) / travelY;
      impact = Math.max(enterX, enterY);
      impactAngle =
        enterX > enterY ? (travelX > 0 ? 180 : 0) : travelY > 0 ? -90 : 90;
    }

    el.style.transform = `translate(${spawnX - half}px, ${spawnY - half}px)`;
    field.appendChild(el);
    badges.push({
      el,
      kind,
      size,
      spawnX,
      spawnY,
      travelX,
      travelY,
      unitX: travelX / distance,
      unitY: travelY / distance,
      duration: distance / SPEEDS[kind],
      impact,
      impactAngle,
      x: spawnX,
      y: spawnY,
      startT: clock,
      stoppedAt: -1,
    });
    lastKind = kind;
    lastDirection = direction;
  };

  const trySpawn = () => {
    const held = badges.some(
      (badge) => badge.kind === "bot" && badge.stoppedAt >= 0
    );
    const kind: Kind =
      lastKind === "bot" || held ? "cf" : rnd(0, 1) < CF_RATIO ? "cf" : "bot";

    spawn(kind);
    nextSpawnAt = clock + rnd(SPAWN_MIN, SPAWN_MAX);
  };

  const absorbed = (badge: Badge) => {
    const half = badge.size / 2;
    return (
      Math.abs(badge.x - stageW / 2) <= WINDOW_W / 2 - half &&
      Math.abs(badge.y - stageH / 2) <= WINDOW_H / 2 - half
    );
  };

  const flash = () => {
    if (!barrier || flashAt < 0) return;
    const t = clock - flashAt;
    if (t >= RISE + HOLD + FADE) {
      resetBarrier();
      return;
    }
    const up = EASE_OUT(Math.min(t / RISE, 1));
    const out = (t - RISE - HOLD) / FADE;
    const env = out > 0 ? 1 - EASE_OUT(Math.min(out, 1)) : up;
    if (bar) {
      bar.style.scale = `1 ${0.5 + 0.5 * env}`;
      bar.style.opacity = `${env}`;
    }
    if (glow) glow.style.opacity = `${0.13 * env}`;
  };

  const rebuild = () => {
    clearBadges();
    resetBarrier();
    lastKind = null;
    lastDirection = null;
    nextSpawnAt = clock;
    measure();
  };

  cleanup(() => {
    clearBadges();
    resetBarrier();
  });

  return {
    tick: (elapsed) => {
      clock = elapsed;
      if (!field || !barrier) return;
      if (stageW <= 0) measure();
      if (stageW <= 0) return;

      if (elapsed >= nextSpawnAt) trySpawn();

      const alive: Badge[] = [];
      for (const badge of badges) {
        const half = badge.size / 2;

        if (badge.stoppedAt < 0) {
          const progress = Math.min(
            (elapsed - badge.startT) / badge.duration,
            1
          );
          const eased = TRAVEL_EASE(progress);
          const blocked = badge.kind === "bot" && eased >= badge.impact;
          const travel = blocked ? badge.impact : eased;
          badge.x = badge.spawnX + badge.travelX * travel;
          badge.y = badge.spawnY + badge.travelY * travel;

          if (blocked) {
            badge.stoppedAt = elapsed;
            const faceX = badge.x + badge.unitX * half;
            const faceY = badge.y + badge.unitY * half;
            barrier.style.translate = `${faceX}px ${faceY - BARRIER_H / 2}px`;
            barrier.style.rotate = `${badge.impactAngle}deg`;
            flashAt = elapsed;
            const axis =
              Math.abs(badge.travelX) >= Math.abs(badge.travelY) ? "x" : "y";
            const push = axis === "x" ? badge.travelX : badge.travelY;
            if (browser) {
              nudgeHit(browser, { axis, amount: Math.sign(push) * 1.5 });
            }
            nudgeHit(barrier, { axis: "x", amount: -1.5 });
          } else {
            if (badge.kind === "cf" && (absorbed(badge) || progress >= 1)) {
              badge.el.remove();
              continue;
            }
            badge.el.style.transform = `translate(${badge.x - half}px, ${badge.y - half}px)`;
            alive.push(badge);
            continue;
          }
        }

        const progress = (elapsed - badge.stoppedAt - CAUGHT_HOLD) / DISSOLVE;
        if (progress >= 1) {
          badge.el.remove();
          continue;
        }
        const knock =
          KNOCKBACK *
          EASE_OUT(Math.min((elapsed - badge.stoppedAt) / KNOCK_TIME, 1));
        const eased = progress > 0 ? DISSOLVE_EASE(progress) : 0;
        const x = badge.x - half - badge.unitX * knock;
        const y = badge.y - half - badge.unitY * knock;
        badge.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - eased * 0.1})`;
        badge.el.style.opacity = `${1 - eased}`;
        alive.push(badge);
      }
      badges = alive;

      flash();
    },
    rebuild,
  };
}
