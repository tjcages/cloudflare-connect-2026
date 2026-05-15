import type { ReactNode } from "react";

export const SectionHeading = ({ title }: { title: ReactNode }) => (
  <div className="section-heading">
    <span>{title}</span>
  </div>
);
