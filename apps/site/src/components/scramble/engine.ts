import { animate, scrambleText } from "animejs";
import {
  type PresetConfig,
  SCRAMBLE_PRESETS,
  type ScramblePreset,
} from "./presets";

type ScrambleOptions = {
  revealDelay?: number;
};

export function scramble(
  el: HTMLElement,
  preset: ScramblePreset,
  options: ScrambleOptions = {}
) {
  const cfg: PresetConfig = SCRAMBLE_PRESETS[preset];
  const override = cfg.override;
  const text = el.textContent ?? "";
  if (override === "") el.textContent = "";

  const animations = [
    animate(el, {
      textContent: scrambleText({
        text,
        chars: cfg.chars,
        from: cfg.from,
        override,
        cursor: cfg.cursor,
        revealRate: cfg.revealRate,
        settleDuration: cfg.settleDuration,
        revealDelay: options.revealDelay,
      }),
    }),
  ];

  if (cfg.blur) {
    animations.push(
      animate(el, {
        filter: [`blur(${cfg.blur}px)`, "blur(0px)"],
        opacity: [0.2, 1],
        duration: 600,
        ease: "out(2)",
      })
    );
  }

  return () => {
    for (const animation of animations) animation.cancel();
  };
}

type SegmentsOptions = {
  baseDelay?: number;
  onSegmentReveal?: (el: HTMLElement, revealDelay: number) => void;
};

export function scrambleSegments(
  root: HTMLElement,
  preset: ScramblePreset,
  options: SegmentsOptions = {}
) {
  const baseDelay = options.baseDelay ?? 0;

  if (root.childElementCount === 0) {
    return scramble(root, preset, { revealDelay: baseDelay });
  }

  const rate = SCRAMBLE_PRESETS[preset].revealRate;
  let offset = 0;
  const cancels: Array<() => void> = [];

  for (const node of root.childNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      offset += node.textContent?.length ?? 0;
      continue;
    }
    const el = node as HTMLElement;
    const revealDelay = baseDelay + (offset / rate) * 1000;
    cancels.push(scramble(el, preset, { revealDelay }));
    options.onSegmentReveal?.(el, revealDelay);
    offset += (el.textContent ?? "").length;
  }

  return () => {
    for (const cancel of cancels) cancel();
  };
}
