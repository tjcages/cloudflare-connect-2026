import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn";

export type SharedBuilderFieldProps = {
  colorField?: boolean;
  className?: string;
  children: ReactNode;
};

export type BuilderFieldDivProps = SharedBuilderFieldProps &
  Omit<ComponentPropsWithoutRef<"div">, keyof SharedBuilderFieldProps | "data-slot"> & {
    as?: "div";
  };

export type BuilderFieldLabelProps = SharedBuilderFieldProps &
  Omit<ComponentPropsWithoutRef<"label">, keyof SharedBuilderFieldProps | "data-slot"> & {
    as: "label";
  };

export type BuilderFieldProps = BuilderFieldDivProps | BuilderFieldLabelProps;

export function BuilderField(props: BuilderFieldDivProps): ReactElement;
export function BuilderField(props: BuilderFieldLabelProps): ReactElement;
export function BuilderField(props: BuilderFieldProps): ReactElement {
  const mergedClass = cn("flex flex-col gap-1.5 text-[12px] text-builder-muted", props.className);
  const colorAttrs = props.colorField ? { "data-color-field": true as const } : {};

  if (props.as === "label") {
    const { as: _omitLabel, children, className: _c, colorField: _cf, ...rest } = props;
    return (
      <label data-slot="builder-field" {...colorAttrs} className={mergedClass} {...rest}>
        {children}
      </label>
    );
  }

  const { children, className: _c2, colorField: _cf2, as: _a, ...rest } = props;
  return (
    <div data-slot="builder-field" {...colorAttrs} className={mergedClass} {...rest}>
      {children}
    </div>
  );
}
