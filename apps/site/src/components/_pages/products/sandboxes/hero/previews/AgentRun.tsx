import { motion } from "motion/react";

import Icon from "@/components/icon/Icon";

import AppHeader from "./AppHeader";
import CountUp from "./CountUp";

const RESULTS: {
  label: string;
  to: number;
  format: (value: number) => string;
}[] = [
  {
    label: "Parsed documents",
    to: 128,
    format: (value) => String(Math.round(value)),
  },
  {
    label: "Redacted secrets",
    to: 14,
    format: (value) => String(Math.round(value)),
  },
  {
    label: "Wrote summary.md",
    to: 4.2,
    format: (value) => `${value.toFixed(1)} kB`,
  },
];

export default function AgentRun() {
  return (
    <div className="flex h-full flex-col gap-12 px-20 pt-16 pb-20">
      <AppHeader
        initial="A"
        title="Agent run"
        subtitle="Untrusted code, isolated"
        meta="2.4s"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: [0.6, 0.6, 0, 1] }}
        className="relative flex min-h-0 flex-1 flex-col justify-between rounded-8 p-12 before:inside-border before:border-border-default before:[transition:none]"
      >
        {RESULTS.map(({ label, to, format }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.24 + index * 0.08,
              ease: [0.6, 0.6, 0, 1],
            }}
            className="flex h-20 items-center gap-8"
          >
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.34 + index * 0.08,
                ease: [0.165, 0.84, 0.44, 1],
              }}
              className="flex-center shrink-0"
            >
              <Icon
                name="checkmark-1-medium"
                size={16}
                className="text-icon-accent-success"
              />
            </motion.span>

            <span className="min-w-0 flex-1 truncate text-body-tiny text-text-default">
              {label}
            </span>

            <CountUp
              to={to}
              format={format}
              delay={0.34 + index * 0.08}
              className="block text-label-tiny whitespace-nowrap text-text-base"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
