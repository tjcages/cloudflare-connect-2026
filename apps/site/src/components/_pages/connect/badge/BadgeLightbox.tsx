"use no memo";

import {
  animate,
  motion,
  useMotionValue,
} from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/icon/Icon";

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { duration: 0.32, ease: EASE } as const;
const CLOSE_SPRING = { duration: 0.26, ease: EASE } as const;
const TILE_RADIUS = 16;
const FULL_RADIUS = 8;

export type BadgeLightboxItem = { src: string; video?: boolean };

function flipFromOrigin(origin: DOMRect, base: DOMRect) {
  return {
    x: origin.left + origin.width / 2 - (base.left + base.width / 2),
    y: origin.top + origin.height / 2 - (base.top + base.height / 2),
    scale: origin.width / base.width,
  };
}

export default function BadgeLightbox({
  items,
  index,
  originRect,
  originRef,
  onClose,
  onPrev,
  onNext,
  caption,
}: {
  items: BadgeLightboxItem[];
  index: number;
  originRect?: DOMRect;
  originRef?: { readonly current: HTMLElement | null };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  caption?: ReactNode;
}) {
  const imgRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const baseRef = useRef<DOMRect | null>(null);
  const ranOpen = useRef(false);
  const closing = useRef(false);
  const navigated = useRef(false);
  const [ready, setReady] = useState(false);
  const [closingUi, setClosingUi] = useState(false);
  const startIndex = useRef(index);
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelEnd = useRef<ReturnType<typeof setTimeout> | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const radius = useMotionValue(FULL_RADIUS);
  const imgOpacity = useMotionValue(0);
  const overlay = useMotionValue(0);

  useEffect(() => {
    const control = animate(overlay, 1, { duration: 0.22 });
    return () => control.stop();
  }, [overlay]);

  function liveOrigin() {
    return originRef?.current?.getBoundingClientRect() ?? originRect;
  }

  function runOpen() {
    const el = imgRef.current;
    if (!el || ranOpen.current) return;
    const sized =
      el instanceof HTMLVideoElement
        ? el.readyState >= 1 && el.videoWidth > 0
        : el.complete && el.naturalWidth > 0;
    if (!sized) return;
    ranOpen.current = true;

    x.set(0);
    y.set(0);
    scale.set(1);
    radius.set(FULL_RADIUS);
    void el.offsetWidth;
    const base = el.getBoundingClientRect();
    baseRef.current = base;

    const origin = liveOrigin();
    if (origin && base.width > 0) {
      const start = flipFromOrigin(origin, base);
      x.set(start.x);
      y.set(start.y);
      scale.set(start.scale);
      radius.set(TILE_RADIUS / start.scale);
    } else {
      scale.set(0.92);
    }
    imgOpacity.set(1);
    setReady(true);

    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    animate(scale, 1, SPRING);
    animate(radius, FULL_RADIUS, SPRING);
  }

  useLayoutEffect(() => {
    runOpen();
    // Open FLIP reads the image size once; later renders keep the motion values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (index !== startIndex.current) navigated.current = true;
  }, [index]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    setClosingUi(true);
    const base = baseRef.current;
    const origin = liveOrigin();
    const canFlip = Boolean(
      origin && base && !navigated.current && ranOpen.current
    );
    if (origin && base && canFlip) {
      const end = flipFromOrigin(origin, base);
      animate(x, end.x, CLOSE_SPRING);
      animate(y, end.y, CLOSE_SPRING);
      animate(scale, end.scale, { ...CLOSE_SPRING, onComplete: onClose });
      animate(radius, TILE_RADIUS / end.scale, CLOSE_SPRING);
    } else {
      animate(scale, scale.get() * 0.9, {
        ...CLOSE_SPRING,
        onComplete: onClose,
      });
    }
    animate(overlay, 0, CLOSE_SPRING);
  }

  function handleDrag() {
    if (closing.current) return;
    const distance = Math.hypot(x.get(), y.get());
    scale.set(Math.max(0.55, 1 - distance / 1400));
    overlay.set(Math.max(0, 1 - distance / 650));
    radius.set(Math.min(28, FULL_RADIUS + distance / 20));
  }

  function handleDragEnd() {
    if (closing.current) return;
    const dx = x.get();
    const dy = y.get();
    if (
      items.length > 1 &&
      Math.abs(dx) > 70 &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      if (dx < 0) goNext();
      else goPrev();
      animate(x, 0, SPRING);
      animate(y, 0, SPRING);
      animate(scale, 1, SPRING);
      animate(radius, FULL_RADIUS, SPRING);
      animate(overlay, 1, { duration: 0.2 });
      return;
    }
    if (Math.hypot(dx, dy) > 110) {
      close();
      return;
    }
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    animate(scale, 1, SPRING);
    animate(radius, FULL_RADIUS, SPRING);
    animate(overlay, 1, { duration: 0.2 });
  }

  function goPrev() {
    navigated.current = true;
    onPrev();
  }

  function goNext() {
    navigated.current = true;
    onNext();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.stopPropagation();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      if (!ready || closing.current) return;
      event.preventDefault();
      x.set(x.get() - event.deltaX);
      y.set(y.get() - event.deltaY);
      handleDrag();
      if (wheelEnd.current) clearTimeout(wheelEnd.current);
      wheelEnd.current = setTimeout(() => handleDragEnd(), 90);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelEnd.current) clearTimeout(wheelEnd.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const current = items[index];
  if (typeof document === "undefined" || !current) return null;

  const mediaClassName =
    "pointer-events-auto max-h-[90vh] max-w-[90vw] cursor-grab object-contain shadow-elevation-default-drops active:cursor-grabbing";

  return createPortal(
    <div
      aria-label="Shareable card"
      aria-modal="true"
      className="fixed inset-0 z-20000"
      ref={rootRef}
      role="dialog"
    >
      <motion.div
        className="absolute inset-0 bg-black/35 backdrop-blur-[24px]"
        onClick={close}
        style={{ opacity: overlay }}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {current.video ? (
          <motion.video
            autoPlay
            className={mediaClassName}
            drag={ready && !closingUi}
            dragElastic={0.9}
            dragMomentum={false}
            key={current.src}
            loop
            muted
            onClick={(event) => event.stopPropagation()}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onLoadedMetadata={runOpen}
            playsInline
            ref={imgRef as RefObject<HTMLVideoElement>}
            src={current.src}
            style={{ x, y, scale, borderRadius: radius, opacity: imgOpacity }}
          />
        ) : (
          <motion.img
            alt=""
            className={mediaClassName}
            drag={ready && !closingUi}
            dragElastic={0.9}
            dragMomentum={false}
            draggable={false}
            key={current.src}
            onClick={(event) => event.stopPropagation()}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onLoad={runOpen}
            ref={imgRef as RefObject<HTMLImageElement>}
            src={current.src}
            style={{ x, y, scale, borderRadius: radius, opacity: imgOpacity }}
          />
        )}
      </div>

      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: overlay }}
      >
        {items.length > 1 ? (
          <button
            aria-label="Previous image"
            className="pointer-events-auto absolute top-1/2 left-16 -translate-y-1/2 rounded-full bg-white/10 p-12 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-white/20 active:scale-[0.98]"
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            type="button"
          >
            <Icon name="arrow-left" size={20} />
          </button>
        ) : null}
        {items.length > 1 ? (
          <button
            aria-label="Next image"
            className="pointer-events-auto absolute top-1/2 right-16 -translate-y-1/2 rounded-full bg-white/10 p-12 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-white/20 active:scale-[0.98]"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            type="button"
          >
            <Icon name="arrow-right" size={20} />
          </button>
        ) : null}
        <button
          aria-label="Close"
          className="pointer-events-auto absolute top-16 right-16 rounded-full bg-white/10 p-10 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-white/20 active:scale-[0.98]"
          onClick={(event) => {
            event.stopPropagation();
            close();
          }}
          type="button"
        >
          <Icon name="cross-small" size={20} />
        </button>
        {caption ? (
          <div className="pointer-events-auto absolute bottom-56 left-1/2 max-w-[85vw] -translate-x-1/2">
            {caption}
          </div>
        ) : null}
        {items.length > 1 ? (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-12 py-4 font-mono text-label-tiny text-white/80 tabular-nums">
            {index + 1} / {items.length}
          </div>
        ) : null}
      </motion.div>
    </div>,
    document.body
  );
}
