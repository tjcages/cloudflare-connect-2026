import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type RailTabProps = {
  tab: string;
  activeTab: string;
  onSelect: (tab: string) => void;
  testId: string;
  iconTestId: string;
  children: ReactNode;
};

export const RailTab = ({ tab, activeTab, onSelect, testId, iconTestId, children }: RailTabProps) => (
  <button
    type="button"
    data-testid={testId}
    aria-pressed={activeTab === tab}
    onClick={() => onSelect(tab)}
    className={cn(
      "grid size-8 cursor-pointer place-items-center rounded-lg border border-transparent bg-builder-surface p-0 text-builder-rail hover:bg-builder-hover-surface hover:text-builder-rail-hover",
      activeTab === tab && "bg-builder-active-surface text-builder-muted",
    )}
  >
    <span data-testid={iconTestId}>{children}</span>
  </button>
);
