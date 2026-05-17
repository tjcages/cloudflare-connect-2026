import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const BuilderFieldHeaderRow = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("flex items-center justify-between gap-2 leading-[calc(4em/3)]", className)}>{children}</div>
);
