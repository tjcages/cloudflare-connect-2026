import type { ReactNode } from "react";

type FieldToggleProps = {
  label: ReactNode;
  pressed: boolean;
  onToggle: () => void;
  testId?: string;
};

export const FieldToggle = ({ label, pressed, onToggle, testId }: FieldToggleProps) => (
  <div className="flex flex-row items-center justify-between gap-3 text-[12px] text-builder-muted">
    <span>{label}</span>
    <button
      type="button"
      data-testid={testId}
      role="switch"
      aria-checked={pressed}
      data-slot="toggle-track"
      className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full border border-builder-hairline bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9fc8ff]"
      onClick={onToggle}
    />
  </div>
);
