import { motion } from "motion/react";

export default function Landing() {
  return (
    <div className="flex h-full flex-col">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.6, 0.6, 0, 1] }}
        className="relative flex h-40 shrink-0 items-center gap-8 px-16 before:inner-border-b before:border-border-default before:[transition:none]"
      >
        <span className="size-12 shrink-0 rounded-t-full bg-icon-faint" />

        <span className="text-label-tiny text-text-base">Acme</span>

        <span className="ml-auto flex items-center gap-12 text-body-tiny text-text-muted">
          <span>Product</span>
          <span>Pricing</span>
          <span>Docs</span>
        </span>

        <span className="rounded-full bg-background-inverse px-8 py-2 text-label-chip text-background-base">
          Sign up
        </span>
      </motion.div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-24 text-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: [0.6, 0.6, 0, 1] }}
          className="rounded-full bg-background-faint px-8 text-label-chip text-text-muted"
        >
          Built in a sandbox
        </motion.span>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.21, ease: [0.6, 0.6, 0, 1] }}
          className="text-heading-h5 text-text-base"
        >
          Ship your ideas faster
        </motion.span>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease: [0.6, 0.6, 0, 1] }}
          className="text-body-tiny text-text-muted"
        >
          Everything you need to launch, in one place.
        </motion.span>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35, ease: [0.6, 0.6, 0, 1] }}
          className="mt-4 flex items-center gap-8"
        >
          <span className="rounded-full bg-background-accent-orange px-12 py-4 text-label-chip text-text-inverse">
            Get started
          </span>

          <span className="relative rounded-full px-12 py-4 text-label-chip text-text-base before:inside-border before:border-border-default before:[transition:none]">
            Learn more
          </span>
        </motion.span>
      </div>
    </div>
  );
}
