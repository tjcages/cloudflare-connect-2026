import { cubicBezier } from "motion";
import { animate, motion, type Variants } from "motion/react";
import { type RefObject, useEffect, useRef } from "react";

const BAR_CENTER_X = 20;
const HEAD_LENGTH = 10;
const DURATION = 0.28;
const HEAD_EASE = cubicBezier(0.6, 0.6, 0, 1);

const SEGMENTS = [
  { id: "head", width: 2, opacity: 1, trail: 0 },
  { id: "trail-1", width: 1.5, opacity: 0.72, trail: 10 },
  { id: "trail-2", width: 1, opacity: 0.46, trail: 6 },
];

export function SnakeIndicator({
  activeIndex,
  containerRef,
  variants,
}: {
  activeIndex: number;
  containerRef: RefObject<HTMLDivElement | null>;
  variants?: Variants;
}) {
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const headYRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const target = container?.querySelectorAll("button")[activeIndex];
    if (!container || !target) {
      return;
    }

    let centerX = BAR_CENTER_X;
    let targetY = target.offsetHeight / 2;
    for (
      let el: HTMLElement | null = target;
      el && el !== container;
      el = el.offsetParent as HTMLElement | null
    ) {
      centerX += el.offsetLeft;
      targetY += el.offsetTop;
    }

    const place = (
      index: number,
      top: number,
      length: number,
      widthScale: number
    ) => {
      const el = segmentRefs.current[index];
      if (!el) {
        return;
      }
      const width = SEGMENTS[index].width * widthScale;
      el.style.width = `${width}px`;
      el.style.height = `${Math.max(0, length)}px`;
      el.style.transform = `translate(${centerX - width / 2}px, ${top}px)`;
    };

    const drawSnake = (headY: number, pulse: number, dir: number) => {
      const widthScale = 1 + pulse;
      place(0, headY - HEAD_LENGTH / 2, HEAD_LENGTH, widthScale);
      let edge = headY - (dir * HEAD_LENGTH) / 2;
      for (let i = 1; i < SEGMENTS.length; i++) {
        const length = SEGMENTS[i].trail * pulse;
        const next = edge - dir * length;
        place(i, Math.min(edge, next), length, widthScale);
        edge = next;
      }
    };

    const settle = (y: number) => {
      headYRef.current = y;
      drawSnake(y, 0, 1);
    };

    animationRef.current?.stop();

    if (headYRef.current === null) {
      settle(targetY);
      return;
    }

    const fromY = headYRef.current;
    const distance = targetY - fromY;
    if (distance === 0) {
      return;
    }
    const dir = distance < 0 ? -1 : 1;

    animationRef.current = animate(0, 1, {
      duration: DURATION,
      ease: "linear",
      onUpdate: (t) => {
        const headY = fromY + HEAD_EASE(t) * distance;
        headYRef.current = headY;
        drawSnake(headY, Math.sin(Math.PI * t), dir);
      },
      onComplete: () => settle(targetY),
    });

    return () => animationRef.current?.stop();
  }, [activeIndex, containerRef]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
      variants={variants}
    >
      {SEGMENTS.map((segment, index) => (
        <span
          className="absolute top-0 left-0 bg-orange-900"
          key={segment.id}
          ref={(el) => {
            segmentRefs.current[index] = el;
          }}
          style={{ width: `${segment.width}px`, opacity: segment.opacity }}
        />
      ))}
    </motion.div>
  );
}
