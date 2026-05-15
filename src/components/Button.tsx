import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "ghost";

/** Matches sidebar Generate (`square`) vs Copy PNG (`inline`). */
export type ButtonPadding = "square" | "inline";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  padding?: ButtonPadding;
};

export const Button = ({
  variant = "default",
  padding = "square",
  className,
  type = "button",
  ...rest
}: ButtonProps) => {
  const root = variant === "ghost" ? "builder-button builder-button--ghost" : "builder-button builder-button--solid";
  const pad = padding === "inline" ? "builder-button--pad-inline" : "builder-button--pad-square";
  const merged = [root, pad, className].filter(Boolean).join(" ");

  return <button type={type} className={merged} {...rest} />;
};
