import type { ReactNode } from "react";

export const SectionHeading = ({ title }: { title: ReactNode }) => (
  <div className="mb-2 flex items-baseline justify-between px-3.5">
    <span className="text-[12px] font-normal text-builder-faint-label">{title}</span>
  </div>
);
