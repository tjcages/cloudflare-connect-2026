import type { ComponentPropsWithoutRef } from "react";
import { BuilderField } from "./BuilderField";

type BuilderTextFieldProps = {
  label: string;
  id: string;
} & Omit<ComponentPropsWithoutRef<"input">, "id">;

export const BuilderTextField = ({ label, id, ...inputProps }: BuilderTextFieldProps) => (
  <BuilderField as="label" htmlFor={id}>
    <span>{label}</span>
    <input id={id} className="builder-field-control" {...inputProps} />
  </BuilderField>
);
