import { useRef } from "react";
import type { IslandProps } from "@/types/island-props";
import { useIllustrationIndex } from "@/components/_animations/shared/illustration-event";
import WordFade from "@/components/_animations/shared/swap/WordFade";
import { boxDelay, RUN_SETS } from "./sets";

type RunRowLabelProps = IslandProps<{ row: 1 | 2 | 3 }>;

export default function RunRowLabel({ row }: RunRowLabelProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const setIndex = useIllustrationIndex(rootRef, "run-set");

  return (
    <WordFade
      delay={boxDelay(row, "pill")}
      ref={rootRef}
      text={RUN_SETS[setIndex].labels[row - 1]}
    />
  );
}
