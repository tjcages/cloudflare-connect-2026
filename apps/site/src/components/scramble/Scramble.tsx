import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import type { IslandProps } from "@/types/island-props";
import { scrambleChars } from "./chars";
import type { From, ScramblePreset } from "./presets";

type ScrambleSegment = { text: string; className?: string };

type ScrambleProps = IslandProps<{
  segments?: ScrambleSegment[];
  text?: string;
  group?: string;
  preset?: ScramblePreset;
  from?: From;
  className?: string;
  onComplete?: () => void;
}>;

export default function Scramble({
  segments,
  text,
  group,
  preset = "eyebrow",
  from,
  className,
  onComplete,
}: ScrambleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [numbered, setNumbered] = useState<string | null>(null);

  useEffect(() => {
    if (group === undefined || text === undefined) return;
    const el = ref.current;
    if (!el) return;
    const members = document.querySelectorAll(
      `[data-scramble-group="${group}"]`
    );
    const n = Array.prototype.indexOf.call(members, el) + 1;
    setNumbered(text.replace("{n}", String(n)));
  }, [group, text]);

  const resolved = group === undefined ? text : numbered;
  const segs = segments ?? (resolved == null ? [] : [{ text: resolved }]);
  const segsKey = segments
    ? segments.map((segment) => segment.text).join(" ")
    : (resolved ?? "");

  useEffect(() => {
    const el = ref.current;
    if (!el || el.childNodes.length === 0) return;
    let cancelScramble: (() => void) | undefined;
    const reveal = () => {
      el.setAttribute("data-revealed", "");
      cancelScramble = scrambleChars(el, preset, from, { onComplete });
    };
    if (typeof requestIdleCallback === "undefined") {
      const timeoutId = setTimeout(reveal, 0);
      return () => {
        clearTimeout(timeoutId);
        cancelScramble?.();
      };
    }
    const idle = requestIdleCallback(reveal, { timeout: 500 });
    return () => {
      cancelIdleCallback(idle);
      cancelScramble?.();
    };
  }, [preset, from, segsKey, onComplete]);

  return (
    <div
      className={cn("opacity-0 data-revealed:opacity-100", className)}
      data-scramble-group={group}
      ref={ref}
    >
      {segs.map((segment) => (
        <span className={segment.className} key={segment.text}>
          {segment.text}
        </span>
      ))}
    </div>
  );
}
