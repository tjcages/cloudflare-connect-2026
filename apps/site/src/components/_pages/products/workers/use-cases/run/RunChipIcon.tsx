import cn from "classnames";
import { useRef, useState } from "react";
import Icon from "@/components/icon/Icon";
import type { IslandProps } from "@/types/island-props";
import IconSwap from "@/components/_animations/shared/swap/IconSwap";
import {
  useIllustrationEvent,
  useIllustrationIndex,
} from "@/components/_animations/shared/illustration-event";
import { boxDelay, RUN_SETS, type RunRowState } from "./sets";

type RunChipIconProps = IslandProps<{ row: 1 | 2 | 3 }>;

export default function RunChipIcon({ row }: RunChipIconProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RunRowState>("pending");
  const setIndex = useIllustrationIndex(rootRef, "run-set");

  useIllustrationEvent<{ row: number; state: RunRowState }>(
    rootRef,
    "run-state",
    (d) => {
      if (d.row === row) setState(d.state);
    }
  );

  const icon = RUN_SETS[setIndex].icons[row - 1];
  const spinning = state === "running";
  const highlighted = state === "active";
  const swap =
    state === "pending"
      ? { delay: boxDelay(row, "chip"), duration: 0.25 }
      : { delay: 0, duration: 0.18 };

  return (
    <IconSwap
      className="size-20"
      ref={rootRef}
      swapKey={spinning ? "spinner" : icon}
      {...swap}
    >
      {spinning ? (
        <Icon
          className="animate-spin text-icon-muted [animation-duration:0.7s] [animation-timing-function:steps(8)]"
          name="loader"
          size={20}
        />
      ) : (
        <Icon
          className={cn(highlighted && "text-purple-900")}
          color="purple"
          disabled={!highlighted}
          name={icon}
          size={20}
          variant="duo"
        />
      )}
    </IconSwap>
  );
}
