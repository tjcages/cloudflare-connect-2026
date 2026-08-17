import { motion } from "motion/react";

import AppHeader from "./AppHeader";
import CountUp from "./CountUp";
import Sparkline from "./Sparkline";
import { ANALYSIS } from "./sparklines";

export default function Analysis() {
  return (
    <div className="flex h-full flex-col gap-12 px-20 pt-16 pb-20">
      <AppHeader
        initial="S"
        title="Sales analysis"
        subtitle="sales.csv · 4,182 rows"
        meta="Q3"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: [0.6, 0.6, 0, 1] }}
        className="relative flex min-h-0 flex-1 flex-col gap-8 rounded-8 p-12 before:inside-border before:border-border-default before:[transition:none]"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24, ease: [0.6, 0.6, 0, 1] }}
          className="flex flex-col"
        >
          <span className="text-body-tiny text-text-muted">Revenue</span>

          <div className="flex items-center gap-8">
            <CountUp
              to={482}
              format={(value) => `$${Math.round(value)}k`}
              delay={0.34}
              className="block text-label-x-small text-text-base"
            />

            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.62,
                ease: [0.165, 0.84, 0.44, 1],
              }}
              className="rounded-full bg-background-faint px-6 text-label-chip text-text-accent-success"
            >
              +18.4%
            </motion.span>
          </div>
        </motion.div>

        <Sparkline
          paths={ANALYSIS}
          delay={0.34}
          className="block min-h-0 w-full flex-1 text-icon-accent-orange"
        />
      </motion.div>
    </div>
  );
}
