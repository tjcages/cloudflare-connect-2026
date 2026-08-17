import { cubicBezier } from "motion";
import { useEffect, useRef } from "react";
import { resolveZoom } from "@/utils/zoom";

const WAVE_EASE = cubicBezier(0.4, 0, 0.2, 1);

interface Props {
  href?: string;
  canvasFromBottom?: number;
  children: React.ReactNode;
}

export default function DottedLink({
  href,
  canvasFromBottom,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spanRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (window.devicePixelRatio || 1) * 2;

    if (!canvas.parentElement) return;

    const zoom = resolveZoom(canvas);
    const width = canvas.parentElement.getBoundingClientRect().width / zoom;

    const height = 10;
    const cy = height / 2;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d", { colorSpace: "display-p3" });
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const dotCount = (width - 2 * 2) / 4;

    const getColorVar = (token: string) =>
      window.getComputedStyle(document.body).getPropertyValue(token).trim();

    let grayColor = getColorVar("--color-text-subtle");
    let orangeColor = getColorVar("--color-orange-900");

    const dots = Array.from({ length: dotCount + 1 }, (_, i) => ({
      x: 2 + i * 4,
    }));

    const drawDot = (x: number, color: string, alpha: number, blur: number) => {
      ctx.globalAlpha = alpha;
      ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 1, cy, 1, 0, Math.PI * 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.filter = "none";
    };

    for (const dot of dots) {
      drawDot(dot.x, grayColor, 1, 0);
    }

    const STAGGER = 12.5;
    const TOTAL_FADE = 75;
    const MAX_BLUR = 1.5;

    type Wave = { origin: number; t0: number; target: number };
    const waves: Wave[] = [];
    const p = dots.map(() => 0);
    const target = dots.map(() => 0);

    let rafId = 0;
    let lastNow = 0;
    let lastEnterOrigin = 0;

    const pointerIndex = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const i = Math.round(((clientX - rect.left) / zoom - 2) / 4);
      return Math.max(0, Math.min(dots.length - 1, i));
    };

    const maxReach = (origin: number) =>
      Math.max(origin, dots.length - 1 - origin) * STAGGER;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < dots.length; i++) {
        const ga = 1 - WAVE_EASE(Math.min(1, p[i] / 0.35));
        const oa = WAVE_EASE(Math.max(0, (p[i] - 0.3) / 0.7));
        if (ga > 0.001) {
          const blur = target[i] === 1 ? (1 - ga) * MAX_BLUR : 0;
          drawDot(dots[i].x, grayColor, ga, blur);
        }
        if (oa > 0.001) {
          drawDot(dots[i].x, orangeColor, oa, 0);
        }
      }
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(50, now - lastNow);
      lastNow = now;

      let baseIdx = -1;
      for (let w = 0; w < waves.length; w++) {
        if (now >= waves[w].t0 + maxReach(waves[w].origin)) baseIdx = w;
      }
      if (baseIdx > 0) waves.splice(0, baseIdx);

      let active = false;
      for (let i = 0; i < dots.length; i++) {
        for (let w = waves.length - 1; w >= 0; w--) {
          if (now >= waves[w].t0 + Math.abs(i - waves[w].origin) * STAGGER) {
            target[i] = waves[w].target;
            break;
          }
        }
        if (p[i] !== target[i]) {
          const dir = Math.sign(target[i] - p[i]);
          p[i] += dir * (dt / TOTAL_FADE);
          if (dir > 0 ? p[i] > target[i] : p[i] < target[i]) p[i] = target[i];
          active = true;
        }
      }

      for (const wv of waves) {
        if (now < wv.t0 + maxReach(wv.origin)) active = true;
      }

      draw();
      rafId = active ? requestAnimationFrame(tick) : 0;
    };

    const spawn = (origin: number, tgt: number) => {
      waves.push({ origin, t0: performance.now(), target: tgt });
      if (!rafId) {
        lastNow = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    const onMouseEnter = (e: MouseEvent) => {
      lastEnterOrigin = pointerIndex(e.clientX);
      spawn(lastEnterOrigin, 1);
    };
    const onMouseLeave = () => spawn(lastEnterOrigin, 0);

    const refreshColors = () => {
      grayColor = getColorVar("--color-text-subtle");
      orangeColor = getColorVar("--color-orange-900");
      draw();
    };

    const el = spanRef.current;
    el?.addEventListener("mouseenter", onMouseEnter);
    el?.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("themechange", refreshColors);

    return () => {
      el?.removeEventListener("mouseenter", onMouseEnter);
      el?.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("themechange", refreshColors);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const canvasNode = (
    <canvas
      className="absolute left-0"
      style={{ bottom: canvasFromBottom ?? -4 }}
      ref={canvasRef}
    />
  );

  if (href) {
    return (
      <a
        className="relative inline-block cursor-pointer transition-all duration-300 hover:text-orange-900"
        href={href}
        ref={spanRef as React.RefObject<HTMLAnchorElement>}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
      >
        {children}
        {canvasNode}
      </a>
    );
  }

  return (
    <span
      className="relative cursor-pointer transition-all duration-300 hover:text-orange-900"
      ref={spanRef as React.RefObject<HTMLSpanElement>}
    >
      {children}
      {canvasNode}
    </span>
  );
}
