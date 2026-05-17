import type { UIEventHandler, ReactNode } from "react";
import { ComponentListItem } from "./ComponentListItem";

const scrollPanelClass = "ui-scroll-overlay flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-3.5 pb-3.5 pt-0";

const headerClass = "-mx-3.5 mb-0 border-b border-builder-hairline px-3.5 py-3.5";

type LayerConfigPanelProps = {
  onScroll: UIEventHandler<HTMLDivElement>;
  title: ReactNode;
  headerPreview: ReactNode;
  children: ReactNode;
};

export const LayerConfigPanel = ({ onScroll, title, headerPreview, children }: LayerConfigPanelProps) => (
  <div className={scrollPanelClass} onScroll={onScroll}>
    <ComponentListItem
      className={headerClass}
      persistActionsOpacity
      testId="component-config-header"
      preview={headerPreview}
      title={title}
    />
    {children}
  </div>
);
