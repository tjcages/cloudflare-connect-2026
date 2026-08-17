import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import {
  createBullet,
  type Bullet,
} from "@/components/_animations/shared/snake-pulse/bullet";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import {
  createCanvasPainter,
  type CanvasPainter,
} from "@/components/_animations/shared/snake-pulse/canvas-snake";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { observeVisibility } from "@/utils/visibility-timers";

export type SnakeThrowOptions = {
  from: Point;
  to: Point;
  /** Fraction of the path where the head stops. Defaults to the path end. */
  arrive?: number;
  /** Element whose hairlines the endpoints snap to. Defaults to the field. */
  root?: HTMLElement | null;
  color?: string;
  onArrive?: () => void;
};

export type SnakeFieldHandle = {
  throw: (options: SnakeThrowOptions) => Promise<void>;
};

type Live = { bullet: Bullet; resolve: () => void };

export default function SnakeField({
  className,
  ref,
}: {
  className?: string;
  ref?: Ref<SnakeFieldHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const painterRef = useRef<CanvasPainter | null>(null);
  const liveRef = useRef<Live[]>([]);
  const visibleRef = useRef(true);
  const rafRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);

  const frame = useCallback((now: number) => {
    const last = lastRef.current || now;
    lastRef.current = now;

    if (visibleRef.current) {
      clockRef.current += (now - last) / 1000;

      for (const live of [...liveRef.current]) {
        live.bullet.throw.update(clockRef.current);
        if (!live.bullet.throw.done) continue;
        live.bullet.snake.destroy();
        liveRef.current = liveRef.current.filter((item) => item !== live);
        live.resolve();
      }

      painterRef.current?.paint();
    }

    rafRef.current = liveRef.current.length ? requestAnimationFrame(frame) : 0;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    painterRef.current = createCanvasPainter(host);

    const stop = observeVisibility(host, 0.01, (visible) => {
      visibleRef.current = visible;
      lastRef.current = 0;
    });

    return () => {
      stop();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      for (const live of liveRef.current) live.resolve();
      liveRef.current = [];
      painterRef.current?.destroy();
      painterRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    throw: (options) =>
      new Promise<void>((resolve) => {
        const host = hostRef.current;
        const painter = painterRef.current;
        if (!host || !painter) {
          resolve();
          return;
        }

        const layout = buildConnector(
          { ...options.from, side: "left" },
          { ...options.to, side: "left" },
          { deep: 0, root: options.root ?? host }
        );

        const color = options.color ?? "orange";
        const bullet = createBullet(painter.makeSnake, layout, color, color, {
          arrive: options.arrive,
        });

        bullet.throw.play({ onArrive: () => options.onArrive?.() });

        liveRef.current = [...liveRef.current, { bullet, resolve }];

        if (!rafRef.current) {
          lastRef.current = 0;
          rafRef.current = requestAnimationFrame(frame);
        }
      }),
  }));

  return <div aria-hidden="true" className={className} ref={hostRef} />;
}
