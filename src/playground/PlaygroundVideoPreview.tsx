import { useEffect, useRef } from "react";
import type { PlaygroundDisplaySize } from "./setupVideoShaderScene";

type PlaygroundVideoPreviewProps = {
  video: HTMLVideoElement;
  display: PlaygroundDisplaySize;
};

/** Native HTML video at exact canvas dimensions (avoids Pixi texture sizing issues). */
export function PlaygroundVideoPreview({ video, display }: PlaygroundVideoPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    video.className = "block shrink-0";
    video.style.width = `${display.width}px`;
    video.style.height = `${display.height}px`;
    // Default object-fit is often `cover`, which crops the bottom; aspect matches canvas.
    video.style.objectFit = "fill";
    video.setAttribute("data-testid", "playground-video-canvas");
    host.appendChild(video);
    void video.play().catch(() => {});

    return () => {
      video.remove();
    };
  }, [video, display.width, display.height]);

  return (
    <div
      ref={hostRef}
      className="rounded border border-neutral-200 bg-white shadow-sm"
      style={{ width: display.width, height: display.height }}
    />
  );
}
