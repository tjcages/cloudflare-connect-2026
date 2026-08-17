import cn from "classnames";
import { motion } from "motion/react";

import Icon from "@/components/icon/Icon";
import type { DuoIconName } from "@/components/icon/icons.gen";

import AppHeader from "./AppHeader";
import CountUp from "./CountUp";
import Sparkline from "./Sparkline";
import { CUSTOMERS, ORDERS, REVENUE, type SparkPaths } from "./sparklines";

const STATS: {
  icon: DuoIconName;
  label: string;
  to: number;
  format: (value: number) => string;
  spark: SparkPaths;
}[] = [
  {
    icon: "currency-dollar",
    label: "Revenue",
    to: 128,
    format: (value) => `$${Math.round(value)}k`,
    spark: REVENUE,
  },
  {
    icon: "3d-package",
    label: "Orders",
    to: 1.8,
    format: (value) => `${value.toFixed(1).replace(".", ",")}k`,
    spark: ORDERS,
  },
  {
    icon: "team",
    label: "Customers",
    to: 612,
    format: (value) => String(Math.round(value)),
    spark: CUSTOMERS,
  },
];

export default function Dashboard() {
  return (
    <div className="flex h-full flex-col gap-12 px-20 pt-16 pb-20">
      <AppHeader
        initial="O"
        title="Overview"
        subtitle="Performance at a glance"
        meta="Last 30 days"
      />

      <div className="flex min-h-0 flex-1">
        {STATS.map(({ icon, label, to, format, spark }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.1 + index * 0.09,
              ease: [0.6, 0.6, 0, 1],
            }}
            className={cn([
              "relative flex min-w-0 flex-1 flex-col gap-12 p-12 before:inside-border before:border-border-default before:[transition:none]",
              index === 0 && "rounded-l-8",
              index === STATS.length - 1 && "rounded-r-8",
            ])}
          >
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.2 + index * 0.09,
                ease: [0.165, 0.84, 0.44, 1],
              }}
              className="flex-center size-20"
            >
              <Icon name={icon} variant="duo" color="orange" size={20} />
            </motion.span>

            <div className="flex flex-col gap-8">
              <div className="flex flex-col">
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.27 + index * 0.09,
                    ease: [0.6, 0.6, 0, 1],
                  }}
                  className="truncate text-body-tiny text-text-muted"
                >
                  {label}
                </motion.span>

                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.34 + index * 0.09,
                    ease: [0.6, 0.6, 0, 1],
                  }}
                >
                  <CountUp
                    to={to}
                    format={format}
                    delay={0.34 + index * 0.09}
                    className="block truncate text-label-x-small text-text-base"
                  />
                </motion.span>
              </div>

              <Sparkline
                paths={spark}
                delay={0.44 + index * 0.09}
                className="block h-16 w-full text-icon-accent-orange"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
