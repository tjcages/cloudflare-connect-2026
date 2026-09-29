import cn from "classnames";
import { motion } from "motion/react";
import Scramble from "./scramble/Scramble";

export default function Eyebrow({
  direction,
  title,
  variant,
  fluid = false,
  className,
  children,
  ...attrs
}: {
  direction: "center" | "left";
  title?: string;
  variant?: "default" | "faint";
  /** Size every part in em from the parent's font-size (e.g. signage cqw type). */
  fluid?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const isFaint = variant === "faint";
  // Fluid mode expresses the fixed 12px design in em so it scales with the text.
  const unit = (px: number) => (fluid ? `${px / 12}em` : px);

  return (
    <div
      {...attrs}
      className={cn(
        "flex w-max items-center",
        direction === "center" ? "mx-auto" : "mr-auto",
        isFaint
          ? "[--eyebrow-color-badge:var(--color-background-muted)] [--eyebrow-color-line-big:var(--color-background-faint)] [--eyebrow-color-line-small:var(--color-background-ghost)]"
          : "[--eyebrow-color-badge:var(--color-orange-900)] [--eyebrow-color-line-big:var(--color-eyebrow-line-big)] [--eyebrow-color-line-small:var(--color-eyebrow-line-small)]",
        className
      )}
    >
      {direction === "center" && (
        <>
          <Line fluid={fluid} size="small" />
          <Line fluid={fluid} size="big" />
        </>
      )}

      <motion.div
        animate={{ width: "auto" }}
        className={cn(
          "bg-(--eyebrow-color-badge) text-center",
          isFaint ? "text-decorative-tiny" : "text-decorative-small",
          "whitespace-nowrap",
          isFaint
            ? "py-px text-text-base"
            : "text-(--eyebrow-color-badge-text,var(--color-text-inverse))",
          "selection:bg-darker/25!"
        )}
        initial={{ width: unit(2) }}
        style={fluid ? { fontSize: "1em", lineHeight: 16 / 12 } : undefined}
        transition={{
          duration: 0.3,
          ease: [0.6, 0.6, 0, 1],
        }}
      >
        <motion.div
          animate={{ paddingLeft: unit(6), paddingRight: unit(6) }}
          className={fluid ? undefined : "px-6"}
          initial={{ paddingLeft: unit(8), paddingRight: unit(8) }}
          transition={{
            delay: 0.3,
            duration: 0.2,
            ease: [0.6, 0.6, 0, 1],
          }}
        >
          {children ?? (
            <Scramble
              from={direction === "center" ? "center" : "left"}
              text={title?.toUpperCase()}
            />
          )}
        </motion.div>
      </motion.div>

      <Line direction="right" fluid={fluid} size="big" />
      <Line direction="right" fluid={fluid} size="small" />
    </div>
  );
}
export const Line = ({
  size,
  direction,
  fluid = false,
}: {
  size: "big" | "small";
  direction?: "left" | "right";
  fluid?: boolean;
}) => {
  const reverse = direction === "right" ? 1 : -1;
  const isBig = size === "big";
  const unit = (px: number) => (fluid ? `${px / 12}em` : px);

  return (
    <motion.div
      animate={{
        x: (isBig ? [0, 6, 2] : [0, 10, 4]).map((px) => unit(px * reverse)),
      }}
      className={cn(
        isBig
          ? "bg-(--eyebrow-color-line-big)"
          : "bg-(--eyebrow-color-line-small)",
        !fluid && (isBig ? "h-12 w-2" : "h-8 w-2")
      )}
      style={
        fluid ? { width: unit(2), height: unit(isBig ? 12 : 8) } : undefined
      }
      initial={{ x: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.6, 0.6, 0, 1],
      }}
    />
  );
};
