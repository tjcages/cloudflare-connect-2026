import cn from "classnames";
import { motion } from "motion/react";
import Scramble from "./scramble/Scramble";

export default function Eyebrow({
  direction,
  title,
  variant,
  ...attrs
}: {
  direction: "center" | "left";
  title?: string;
  variant?: "default" | "faint";
} & React.HTMLAttributes<HTMLDivElement>) {
  const isFaint = variant === "faint";

  return (
    <div
      {...attrs}
      className={cn(
        attrs.className,
        "flex w-max items-center",
        direction === "center" ? "mx-auto" : "mr-auto",
        isFaint
          ? "[--eyebrow-color-badge:var(--color-background-muted)] [--eyebrow-color-line-big:var(--color-background-faint)] [--eyebrow-color-line-small:var(--color-background-ghost)]"
          : "[--eyebrow-color-badge:var(--color-orange-900)] [--eyebrow-color-line-big:var(--color-eyebrow-line-big)] [--eyebrow-color-line-small:var(--color-eyebrow-line-small)]"
      )}
    >
      {direction === "center" && (
        <>
          <Line size="small" />
          <Line size="big" />
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
        initial={{ width: 2 }}
        transition={{
          duration: 0.3,
          ease: [0.6, 0.6, 0, 1],
        }}
      >
        <motion.div
          animate={{ paddingLeft: 6, paddingRight: 6 }}
          className="px-6"
          initial={{ paddingLeft: 8, paddingRight: 8 }}
          transition={{
            delay: 0.3,
            duration: 0.2,
            ease: [0.6, 0.6, 0, 1],
          }}
        >
          <Scramble
            from={direction === "center" ? "center" : "left"}
            text={title?.toUpperCase()}
          />
        </motion.div>
      </motion.div>

      <Line direction="right" size="big" />
      <Line direction="right" size="small" />
    </div>
  );
}
export const Line = ({
  size,
  direction,
}: {
  size: "big" | "small";
  direction?: "left" | "right";
}) => {
  const reverse = direction === "right" ? 1 : -1;
  const isBig = size === "big";

  return (
    <motion.div
      animate={{
        x: isBig
          ? [0, 6 * reverse, 2 * reverse]
          : [0, 10 * reverse, 4 * reverse],
      }}
      className={cn(
        "w-2",
        isBig
          ? "h-12 bg-(--eyebrow-color-line-big)"
          : "h-8 bg-(--eyebrow-color-line-small)"
      )}
      initial={{ x: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.6, 0.6, 0, 1],
      }}
    />
  );
};
