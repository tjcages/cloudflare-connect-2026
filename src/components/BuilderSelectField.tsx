import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { BuilderField } from "./BuilderField";

type BuilderSelectFieldProps = {
  label: string;
  id: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"select">, "id" | "children">;

export const BuilderSelectField = ({ label, id, children, ...selectProps }: BuilderSelectFieldProps) => (
  <BuilderField as="label" htmlFor={id}>
    <span>{label}</span>
    <select id={id} className="builder-field-control" {...selectProps}>
      {children}
    </select>
  </BuilderField>
);
