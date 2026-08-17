import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { useEffect, useState } from "react";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";

const MAX_DPR = 1.5;

export default function AgendaTwizzlerOverlay() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;

    const outputCanvas = document.querySelector<HTMLCanvasElement>(
      "[data-agenda-twizzler-output]"
    );
    if (!outputCanvas) return;

    const root = outputCanvas.closest<HTMLElement>(
      "[data-agenda-twizzler-root]"
    );
    const sourceCanvas = root?.querySelector<HTMLCanvasElement>(
      "[data-agenda-twizzler-source] canvas"
    );
    const apertureElements = root
      ? Array.from(
          root.querySelectorAll<HTMLElement>("[data-agenda-twizzler-aperture]")
        )
      : [];
    const context = outputCanvas.getContext("2d");
    if (!root || !sourceCanvas || apertureElements.length === 0 || !context)
      return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let visible = false;
    let animationFrame = 0;

    const paint = () => {
      if (width < 1 || height < 1 || sourceCanvas.width < 1) return;

      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const aperture of apertureElements) {
        const rect = aperture.getBoundingClientRect();
        context.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
          (rect.left - rootRect.left) / zoom,
          (rect.top - rootRect.top) / zoom,
          rect.width / zoom,
          rect.height / zoom
        );
      }
      outputCanvas.style.opacity = "1";
    };

    const tick = () => {
      if (!visible) return;
      paint();
      animationFrame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!visible || animationFrame) return;
      if (reducedMotion.matches) {
        paint();
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const resize = () => {
      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      width = rootRect.width / zoom;
      height = rootRect.height / zoom;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      outputCanvas.width = Math.max(1, Math.round(width * dpr));
      outputCanvas.height = Math.max(1, Math.round(height * dpr));
      if (visible) paint();
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      },
      { rootMargin: "240px" }
    );
    const resizeObserver = new ResizeObserver(resize);
    const onMotionChange = () => {
      stop();
      if (visible) start();
    };

    resize();
    intersectionObserver.observe(root);
    resizeObserver.observe(root);
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [ready]);

  return (
    <>
      <div
        className="absolute inset-x-40 top-40 h-200 opacity-0"
        data-agenda-twizzler-source
      >
        <ConnectTwizzler
          canvasClassName="size-full"
          className="size-full"
          maxDpr={MAX_DPR}
          maxFps={30}
          onReady={() => setReady(true)}
          rootMargin="240px"
          settings={CONNECT_HERO_TWIZZLER_DEFAULTS}
        />
      </div>
      <canvas
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-0 transition-opacity duration-300"
        data-agenda-twizzler-output
      />
    </>
  );
}
