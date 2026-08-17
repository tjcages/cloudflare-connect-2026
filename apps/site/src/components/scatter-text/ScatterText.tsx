import cn from "classnames";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import AnimatedWidth from "@/components/animated-size/AnimatedWidth";

const LETTER = 0.18;
const SCATTER = 0.22;
const SEQUENCE = 0.006;
const SHRINK = 0.5;

// Scatter: each letter waits a random slice of the window instead of taking its
// turn in order. Derived from the generation rather than drawn per render, so a
// letter keeps its offset across re-renders, the server and client agree, and
// every swap scatters differently — including the letters on their way out,
// which hold the offset they came in with.
const scatterDelay = (generation: number, index: number) => {
  const noise = Math.sin(generation * 97.13 + index * 41.7) * 43758.5453;
  return (noise - Math.floor(noise)) * SCATTER;
};

export default function ScatterText({
  className,
  letterClassName,
  stagger = "scatter",
  text,
}: {
  className?: string;
  letterClassName?: string;
  stagger?: "scatter" | "sequence";
  text: string;
}) {
  const [seen, setSeen] = useState({ text, generation: 0 });

  let generation = seen.generation;
  if (seen.text !== text) {
    generation = seen.generation + 1;
    setSeen({ text, generation });
  }

  // One window for the whole name, so the width tracks the letters arriving
  // rather than opening ahead of them and leaving a gap.
  const sweep =
    stagger === "sequence" ? LETTER + text.length * SEQUENCE : LETTER + SCATTER;

  return (
    <AnimatedWidth
      transition={{ duration: sweep, ease: [0.165, 0.84, 0.44, 1] }}
    >
      <span className={className}>
        <AnimatePresence initial={false} mode="popLayout">
          {text.split("").map((char, index) => (
            <motion.span
              key={`${generation}-${index}`}
              // The server renders generation 0, so those letters mount at full
              // size — only a swap grows them in.
              initial={
                generation === 0
                  ? false
                  : { opacity: 0, scale: SHRINK, filter: "blur(1.2px)" }
              }
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: SHRINK, filter: "blur(1.2px)" }}
              transition={{
                duration: LETTER,
                delay:
                  stagger === "sequence"
                    ? index * SEQUENCE
                    : scatterDelay(generation, index),
                ease: [0.165, 0.84, 0.44, 1],
              }}
              className={cn(["inline-block whitespace-pre", letterClassName])}
            >
              {char}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </AnimatedWidth>
  );
}
