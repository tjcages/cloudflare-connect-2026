import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "default" | "ghost";

/** Matches sidebar Generate (`square`) vs Copy PNG (`inline`). */
export type ButtonPadding = "square" | "inline";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  padding?: ButtonPadding;
};

const buttonBase =
  "shrink-0 cursor-pointer rounded-md text-[12px] leading-none font-normal focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[#d8d8d8] disabled:cursor-default disabled:opacity-45";

const solid =
  "border border-builder-hairline bg-builder-surface text-builder-control hover:bg-builder-hover-surface hover:text-builder-muted active:bg-builder-active-surface";

const ghost =
  "border border-transparent bg-transparent text-builder-control hover:bg-builder-hover-surface hover:text-builder-muted active:bg-builder-active-surface";

export const Button = ({
  variant = "default",
  padding = "square",
  className,
  type = "button",
  ...rest
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={cn(
        buttonBase,
        variant === "ghost" ? ghost : solid,
        padding === "inline" ? "px-2.5 py-1.5" : "p-1.5",
        className,
      )}
      {...rest}
    />
  );
};
