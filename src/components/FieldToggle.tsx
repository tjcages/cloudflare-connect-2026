import type { ReactNode } from "react";

type FieldToggleProps = {
  label: ReactNode;
  pressed: boolean;
  onToggle: () => void;
  testId?: string;
};

export const FieldToggle = ({ label, pressed, onToggle, testId }: FieldToggleProps) => (
  <div className="field field-toggle-row">
    <span>{label}</span>
    <button
      type="button"
      data-testid={testId}
      className={["field-toggle-switch", pressed ? "field-toggle-switch-on" : ""].filter(Boolean).join(" ")}
      onClick={onToggle}
    />
  </div>
);
