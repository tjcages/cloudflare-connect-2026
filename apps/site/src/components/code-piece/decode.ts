import { scrambleSegments } from "@/components/scramble/engine";
import type { ScramblePreset } from "@/components/scramble/presets";

const CODE_PRESET: ScramblePreset = "decrypt";
const HOLD_MAX = 500;

function revealPiece(root: HTMLElement) {
  const baseDelay = Math.random() * HOLD_MAX;

  scrambleSegments(root, CODE_PRESET, {
    baseDelay,
    onSegmentReveal: (el, revealDelay) => {
      setTimeout(() => {
        el.setAttribute("data-lit", "");
      }, revealDelay);
    },
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.setAttribute("data-decoded", "");
    });
  });
}

export function decodeCodePieces() {
  const pieces = [
    ...document.querySelectorAll<HTMLElement>("[data-code-decode]"),
  ];

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        obs.unobserve(el);
        revealPiece(el);
      }
    },
    { threshold: 0, rootMargin: "0px 0px -20% 0px" }
  );

  for (const el of pieces) observer.observe(el);
}
