import { animate, cubicBezier } from "motion";
import { useEffect, useRef, useState } from "react";

import AnimatedWidth from "@/components/animated-size/AnimatedWidth";
import Icon from "@/components/icon/Icon";

const MAX_NODES = 8;
const VISITORS_PER_NODE = 600;
const NODE_HYSTERESIS = 150;
const REVEAL_LEAD = 0.1;

const SHAKE_FULL_RATE = 2500;
const SHAKE_MAX_DEGREES = 0.9;

const TREND_RATE = 250;
const STREAM_FULL_RATE = 1000;
const STREAM_SLOTS = 5;

const EASE_OUT = cubicBezier(0.165, 0.84, 0.44, 1);
const EASE = cubicBezier(0.6, 0.6, 0, 1);

type Cycle = {
  from: number;
  to: number;
  peak: number;
  idle: number;
  ramp: number;
  hold: number;
  decay: number;
  duration: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makeCycle(from: number, idle: number): Cycle {
  const ramp = rand(2.5, 4);
  const hold = rand(1.5, 3);
  const decay = rand(3, 5);

  return {
    from,
    to: Math.min(500, Math.max(200, from + rand(-90, 90))),
    peak: rand(4800, 5900),
    idle,
    ramp,
    hold,
    decay,
    duration: idle + ramp + hold + decay,
  };
}

function sampleCycle(
  { from, to, peak, idle, ramp, hold, decay }: Cycle,
  t: number
) {
  if (t < idle) return from;

  if (t < idle + ramp) {
    const u = (t - idle) / ramp;
    return from + (peak - from) * u * u * (3 - 2 * u);
  }

  if (t < idle + ramp + hold) return peak;

  const u = Math.min((t - idle - ramp - hold) / decay, 1);
  return peak + (to - peak) * u * u * (3 - 2 * u);
}

function nodesFor(visitors: number, current: number) {
  let count = current;

  while (count < MAX_NODES && visitors >= count * VISITORS_PER_NODE) count++;
  while (
    count > 1 &&
    visitors < (count - 1) * VISITORS_PER_NODE - NODE_HYSTERESIS
  )
    count--;

  return count;
}

export default function AutoScaleCounter() {
  const [visitors, setVisitors] = useState(328);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pill = pillRef.current;
    const scope = pill?.closest<HTMLElement>("[data-auto-scale]");
    if (!pill || !scope) return;

    const arrow = pill.querySelector<HTMLElement>("[data-trend-arrow]");
    const glyphs = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-trend-glyph]")
    );
    if (!arrow) return;

    const nodes = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-scale-node]")
    ).sort((a, b) => Number(a.dataset.scaleNode) - Number(b.dataset.scaleNode));

    const pending = new Map<number, number>();

    const cancelPending = (index: number) => {
      const timer = pending.get(index);
      if (timer === undefined) return;

      clearTimeout(timer);
      pending.delete(index);
    };

    const hop = (index: number, delay: number) => {
      const node = nodes[index];
      const wrapper = node.parentElement;
      if (!wrapper) return;

      cancelPending(index);

      // Browser's reveal takes 450ms, so firing data-active at the apex left it
      // still resolving well after the box had landed. Start the reveal first
      // and take off REVEAL_LEAD later, which puts the box visibly on by the
      // time it peaks at +0.116s.
      animate(
        wrapper,
        { y: [0, -1.5, 0.5, 0] },
        {
          duration: 0.34,
          delay: delay + REVEAL_LEAD,
          times: [0, 0.34, 0.68, 1],
          ease: [EASE_OUT, EASE, EASE],
        }
      );

      const timer = window.setTimeout(() => {
        pending.delete(index);
        node.setAttribute("data-active", "true");
      }, delay * 1000);
      pending.set(index, timer);
    };

    let active = 1;
    let cycle = makeCycle(rand(200, 500), 0.3);
    let phaseTime = 0;
    let untilTick = 0;
    let lastTick = 0;
    let lastSignal = -1;
    let shakeSign = 1;
    let trend = 0;
    let surge = 0;
    const drift = glyphs.map(() => 0);
    const origin = glyphs.map(() => 0);
    const trip = glyphs.map(() => 1);
    const edge = glyphs.map(() => 0.3);
    const gone = glyphs.map(() => 0);
    const tint = glyphs.map(() => 0);
    const pace = glyphs.map(() => 1);
    const live = glyphs.map(() => false);

    const seed = (slot: number, spread = 0) => {
      drift[slot] = rand(-46, 46);
      origin[slot] = rand(-56, -14);
      trip[slot] = rand(46, 88);
      pace[slot] = rand(0.55, 1.5);
      edge[slot] = rand(0.18, 0.4);
      tint[slot] = rand(0.45, 1);
      live[slot] = Math.sqrt(surge) > rand(0, 1);
      gone[slot] = spread * trip[slot];
      glyphs[slot].style.scale = `${rand(0.7, 1.1).toFixed(2)}`;
    };

    for (let slot = 0; slot < STREAM_SLOTS; slot++) seed(slot, rand(0, 1));
    let last = 0;
    let frame = 0;
    let running = false;
    let onScreen = false;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      phaseTime += dt;

      const step = 100 * dt;

      for (let slot = 0; slot < STREAM_SLOTS; slot++) {
        const glyph = glyphs[slot];
        gone[slot] += step * pace[slot];

        if (gone[slot] > trip[slot]) seed(slot);

        const spent = gone[slot] / trip[slot];
        const rise = origin[slot] + gone[slot];

        glyph.style.translate = `${drift[slot].toFixed(2)}px ${(trend < 0 ? rise : -rise).toFixed(2)}px`;
        glyph.style.opacity = (
          live[slot]
            ? tint[slot] *
              Math.min(spent / edge[slot], (1 - spent) / edge[slot], 1)
            : 0
        ).toFixed(3);
      }

      if (phaseTime >= cycle.duration) {
        phaseTime -= cycle.duration;
        cycle = makeCycle(cycle.to, rand(1, 2));
      }

      untilTick -= dt;
      if (untilTick > 0) return;

      const tickDt = lastTick ? (now - lastTick) / 1000 : 0.07;
      lastTick = now;
      untilTick = rand(0.05, 0.09);

      const signal = sampleCycle(cycle, phaseTime);
      const rate = lastSignal < 0 ? 0 : (signal - lastSignal) / tickDt;
      lastSignal = signal;

      setVisitors(
        Math.max(1, Math.round(signal * (1 + (Math.random() - 0.5) * 0.04)))
      );

      shakeSign = -shakeSign;
      const intensity = Math.min(Math.abs(rate) / SHAKE_FULL_RATE, 1);
      pill.style.rotate =
        intensity > 0.03
          ? `${shakeSign * intensity * SHAKE_MAX_DEGREES}deg`
          : "0deg";

      surge = Math.min(Math.abs(rate) / STREAM_FULL_RATE, 1);

      const nextTrend = rate > TREND_RATE ? 1 : rate < -TREND_RATE ? -1 : 0;
      if (nextTrend !== trend) {
        trend = nextTrend;
        scope.toggleAttribute("data-rising", trend > 0);
        scope.toggleAttribute("data-falling", trend < 0);

        if (trend !== 0) {
          arrow.style.rotate = trend > 0 ? "90deg" : "270deg";
          for (let slot = 0; slot < STREAM_SLOTS; slot++)
            seed(slot, rand(0, 1));
        }
      }

      const count = nodesFor(Math.round(signal), active);
      if (count > active) {
        for (let index = active; index < count; index++) {
          hop(index, (index - active) * 0.07);
        }
      } else if (count < active) {
        for (let index = count; index < active; index++) {
          cancelPending(index);
          nodes[index].removeAttribute("data-active");
        }
      }
      active = count;
    };

    const sync = () => {
      const shouldRun = onScreen && document.visibilityState === "visible";
      if (shouldRun === running) return;

      running = shouldRun;
      if (shouldRun) {
        last = performance.now();
        lastTick = 0;
        frame = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(frame);
        pill.style.rotate = "0deg";
        surge = 0;
        for (const glyph of glyphs) glyph.style.opacity = "0";
      }
    };

    const observer = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      sync();
    });
    observer.observe(scope);
    document.addEventListener("visibilitychange", sync);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div className="absolute top-40 left-1/2 text-(--color-dynamic-green-1) transition-colors duration-450 group-data-falling/trend:text-(--color-dynamic-red-1)">
        {Array.from({ length: STREAM_SLOTS }, (_, slot) => (
          <div
            className="absolute -mt-6 -ml-6 rotate-90 opacity-0 group-data-falling/trend:-rotate-90"
            data-trend-glyph
            key={slot}
          >
            <Icon className="[&_path]:stroke-2" name="arrow-left" size={12} />
          </div>
        ))}
      </div>

      <div
        ref={pillRef}
        className="absolute top-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background-base py-6 pr-6 pl-8 shadow-elevation-default transition-[rotate] duration-120 ease-[cubic-bezier(0.45,0,0.55,1)]"
      >
        <Icon name="user" variant="duo" color="orange" size={20} />
        <div className="flex items-center px-4 text-label-x-small whitespace-nowrap text-text-base">
          <AnimatedWidth transition={{ duration: 0.2, ease: EASE_OUT }}>
            <span className="block tabular-nums">{visitors}</span>
          </AnimatedWidth>
          <span>&nbsp;visitors</span>
        </div>
        <div className="flex w-0 shrink-0 justify-center transition-[width] delay-70 duration-250 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-falling/trend:w-20 group-data-falling/trend:delay-0 group-data-rising/trend:w-20 group-data-rising/trend:delay-0">
          <div className="relative size-20 shrink-0 scale-0 rounded-full opacity-0 transition delay-70 duration-250 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-falling/trend:scale-100 group-data-falling/trend:bg-(--color-dynamic-red-7) group-data-falling/trend:text-(--color-dynamic-red-1) group-data-falling/trend:opacity-100 group-data-falling/trend:delay-0 group-data-rising/trend:scale-100 group-data-rising/trend:bg-(--color-dynamic-green-7) group-data-rising/trend:text-(--color-dynamic-green-1) group-data-rising/trend:opacity-100 group-data-rising/trend:delay-0">
            <div
              className="absolute inset-0 flex-center rotate-90"
              data-trend-arrow
            >
              <Icon
                className="scale-50 opacity-0 transition duration-180 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-falling/trend:scale-100 group-data-falling/trend:opacity-100 group-data-falling/trend:delay-70 group-data-rising/trend:scale-100 group-data-rising/trend:opacity-100 group-data-rising/trend:delay-70 [&_path]:stroke-[1.786]"
                name="arrow-left"
                size={14}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
