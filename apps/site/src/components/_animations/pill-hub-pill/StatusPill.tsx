import SwapPill from "@/components/_animations/shared/swap/SwapPill";
import Icon from "@/components/icon/Icon";
import type { IslandProps } from "@/types/island-props";
import type { StatusPhase } from "./visual";

interface StatusPillProps {
  labels: [string, ...string[]];
}

type Detail = { phase: StatusPhase; index: number };

export default function StatusPill({ labels }: IslandProps<StatusPillProps>) {
  return (
    <SwapPill<Detail>
      channel="pill:status"
      className="flex h-20 items-center"
      face={(detail) =>
        detail.phase === "idle"
          ? null
          : {
              swapKey: labels[detail.index],
              label: labels[detail.index],
              icon: (
                <Icon
                  className="text-icon-accent-success"
                  name="checkmark-1-medium"
                  size={20}
                />
              ),
            }
      }
      initial={{ phase: "idle", index: 0 }}
      labelClassName="relative flex h-20 items-center px-4"
      rowClassName="flex items-center gap-4"
    />
  );
}
