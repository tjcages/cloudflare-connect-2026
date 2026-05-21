import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { BuilderField } from "./BuilderField";

type BuilderTextareaFieldProps = {
  label: string;
  id: string;
} & Omit<ComponentPropsWithoutRef<"textarea">, "id">;

export const BuilderTextareaField = forwardRef<HTMLTextAreaElement, BuilderTextareaFieldProps>(
  ({ label, id, className, ...textareaProps }, ref) => (
    <BuilderField as="label" htmlFor={id}>
      <span>{label}</span>
      <textarea
        ref={ref}
        id={id}
        className={className ?? "builder-field-control min-h-[120px] resize-y font-mono text-[11px]"}
        {...textareaProps}
      />
    </BuilderField>
  ),
);

BuilderTextareaField.displayName = "BuilderTextareaField";
