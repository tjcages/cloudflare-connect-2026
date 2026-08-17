import { motion } from "motion/react";

export default function AppHeader({
  initial,
  title,
  subtitle,
  meta,
}: {
  initial: string;
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <div className="flex shrink-0 items-end gap-12">
      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.6, 0.6, 0, 1] }}
        className="flex-center size-32 shrink-0"
      >
        <span className="relative flex-center size-28 rounded-full bg-background-faint text-label-tiny text-text-muted before:inner-border before:border-border-default before:[transition:none]">
          {initial}
        </span>
      </motion.span>

      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.6, 0.6, 0, 1] }}
        className="flex min-w-0 flex-1 flex-col"
      >
        <span className="truncate text-label-tiny text-text-base">{title}</span>
        <span className="truncate text-body-tiny text-text-muted">
          {subtitle}
        </span>
      </motion.span>

      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.6, 0.6, 0, 1] }}
        className="text-body-tiny whitespace-nowrap text-text-subtle"
      >
        {meta}
      </motion.span>
    </div>
  );
}
