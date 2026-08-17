import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import HeroWindow from "@/components/HeroWindow";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import Icon from "@/components/icon/Icon";
import RunStatus from "@/components/run-status/RunStatus";
import ScatterText from "@/components/scatter-text/ScatterText";
import { observeVisibility } from "@/utils/visibility-timers";

import EmailPreview from "./EmailPreview";
import type { EmailKind, Ghosts } from "./emails";
import {
  ARM_DELAY_MS,
  EMAILS,
  OPENING_MS,
  ROW_HEIGHT,
  ROW_COLLAPSE_MS,
  ROW_HEIGHT_RUNNING,
  SEED_GHOSTS,
  SETTLE_MS,
  STEP_DURATIONS,
  makeGhosts,
} from "./emails";

interface Run {
  key: number;
  kind: EmailKind;
  ghosts: Ghosts;
}

// The cycle order, run backwards — the feed opens on the tail of a previous
// pass, every row already sent. The first running row arrives after the
// entrance settles.
const INITIAL_RUNS: Run[] = EMAILS.slice(1)
  .reverse()
  .map((kind, index) => ({ key: index, kind, ghosts: SEED_GHOSTS }));

export default function EmailRuns() {
  const [runs, setRuns] = useState<Run[]>(INITIAL_RUNS);
  const [step, setStep] = useState(0);
  const [armed, setArmed] = useState(false);
  // Layout, tracked apart from `armed`: the row stays tall while the stroke
  // withdraws and the badge fades. Driving the row heights and the stacking
  // offsets off one value keeps the rows below from riding up into it.
  const [expanded, setExpanded] = useState(false);
  const [sent, setSent] = useState(false);
  const [started, setStarted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!armed || !pillRef.current) return;
    nudgeHit(pillRef.current, { axis: "x", amount: 3 });
  }, [armed, step]);

  useEffect(() => {
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let collapse: ReturnType<typeof setTimeout> | undefined;
    let key = INITIAL_RUNS.length;
    let cycle = 0;
    let phase: "arming" | "stepping" | "settling" = "settling";
    let current = 0;

    const queue = () => {
      clearTimeout(timer);
      if (!visible) return;

      if (phase === "arming") {
        timer = setTimeout(() => {
          setArmed(true);
          setExpanded(true);
          setStep(0);
          phase = "stepping";
          current = 0;
          queue();
        }, ARM_DELAY_MS);
        return;
      }

      if (phase === "stepping") {
        timer = setTimeout(() => {
          current += 1;
          if (current < STEP_DURATIONS.length) {
            setStep(current);
            queue();
            return;
          }
          setArmed(false);
          setSent(true);
          clearTimeout(collapse);
          collapse = setTimeout(() => setExpanded(false), ROW_COLLAPSE_MS);
          phase = "settling";
          queue();
        }, STEP_DURATIONS[current]);
        return;
      }

      timer = setTimeout(
        () => {
          const kind = EMAILS[cycle % EMAILS.length];
          cycle += 1;
          setStarted(true);
          setSent(false);
          setStep(0);
          const run = { key: key++, kind, ghosts: makeGhosts() };
          setRuns((rs) => [run, ...rs].slice(0, 6));
          phase = "arming";
          queue();
        },
        cycle === 0 ? OPENING_MS : SETTLE_MS
      );
    };

    const stopObserving = observeVisibility(rootRef.current!, 0, (next) => {
      visible = next;
      setIsVisible(next);
      queue();
    });

    return () => {
      stopObserving();
      clearTimeout(timer);
      clearTimeout(collapse);
    };
  }, []);

  const settled = !started || sent;
  const reveal = settled ? 3 : step;
  const active = runs[0];

  let offset = 0;
  const tops = runs.map((_, index) => {
    const top = offset;
    offset += index === 0 && expanded ? ROW_HEIGHT_RUNNING : ROW_HEIGHT;
    return top;
  });

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-run-surface=""
      data-visible={isVisible ? "" : undefined}
      className="pointer-events-none absolute inset-0"
    >
      <HeroWindow variant="primary">
        <div className="relative z-20 flex h-56 items-center gap-12 bg-background-base px-20 before:inside-border-b before:border-border-muted">
          <Icon
            name="product-email-service"
            variant="duo"
            color="orange"
            size={20}
          />
          <span className="text-label-x-small text-text-base">
            Email Service
          </span>
        </div>

        <div className="relative z-10 flex h-44 items-center gap-12 bg-background-surface px-20 text-body-x-small text-text-muted before:inside-border-b before:border-border-default">
          <span className="w-188">Type</span>
          <span className="min-w-0 flex-1">Delivery</span>
          <span className="w-96">Status</span>
        </div>

        <div className="relative h-300">
          {runs.map((run, index) => {
            const running = started && index === 0;
            return (
              <motion.div
                key={run.key}
                initial={
                  run.key < INITIAL_RUNS.length
                    ? { y: tops[index] + 8, opacity: 0, filter: "blur(2px)" }
                    : { y: -ROW_HEIGHT, opacity: 0, filter: "blur(0px)" }
                }
                animate={{
                  y: tops[index],
                  height: running && expanded ? ROW_HEIGHT_RUNNING : ROW_HEIGHT,
                  opacity: 1,
                  filter: "blur(0px)",
                }}
                transition={
                  started
                    ? {
                        duration: 0.45,
                        ease: [0.6, 0.6, 0, 1],
                        height: { duration: 0.3, ease: [0.165, 0.84, 0.44, 1] },
                      }
                    : {
                        duration: 0.35,
                        ease: [0.6, 0.6, 0, 1],
                        delay: 0.2 + run.key * 0.07,
                      }
                }
                className="absolute inset-x-0 top-0 overflow-clip p-20 before:inside-border-b before:border-border-default"
              >
                <div className="flex gap-12">
                  <div className="flex w-188 items-start gap-12">
                    <Icon
                      name={run.kind.icon}
                      size={20}
                      className="shrink-0 text-icon-default"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body-x-small text-text-base">
                        {run.kind.title}
                      </span>
                      <span className="truncate text-body-x-small text-text-muted">
                        {run.kind.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-x-small text-text-default">
                      {run.kind.address}
                    </span>
                    <span className="truncate text-body-x-small text-text-muted">
                      {run.kind.via}
                    </span>
                  </div>

                  <div className="w-96">
                    <RunStatus
                      doneLabel="Sent"
                      running={running && !sent}
                      tone="orange"
                    />
                  </div>
                </div>

                {/* Absolute, so the row's height animation cannot drag it and
                    popLayout has no layout to re-pin it out of. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {running && armed && (
                    <div
                      key="step"
                      className="absolute top-76 left-20 flex h-28 gap-12"
                    >
                      <div className="relative z-10 w-20 shrink-0">
                        <svg
                          aria-hidden
                          viewBox="0 0 22 56"
                          fill="none"
                          className="absolute -top-28 left-0 h-56 w-22 text-neutral-6"
                        >
                          {/* Draws from the top down. Leaving, it retracts
                              from the top too — pathOffset walks the start
                              forward while pathLength closes behind it — so
                              the stroke withdraws into the badge instead of
                              playing the entrance backwards. */}
                          <motion.path
                            d="M10 0V38C10 40.2091 11.7909 42 14 42H22"
                            stroke="currentColor"
                            initial={{ pathLength: 0, pathOffset: 0 }}
                            animate={{ pathLength: 1, pathOffset: 0 }}
                            exit={{
                              pathLength: 0,
                              pathOffset: 1,
                              transition: {
                                duration: 0.28,
                                ease: [0.165, 0.84, 0.44, 1],
                              },
                            }}
                            transition={{
                              duration: 0.4,
                              ease: [0.6, 0.6, 0, 1],
                              delay: 0.12,
                            }}
                          />
                        </svg>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, x: -8, scale: 0.94 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: 8,
                          scale: 0.94,
                          transition: {
                            duration: 0.25,
                            ease: [0.165, 0.84, 0.44, 1],
                            delay: 0.22,
                          },
                        }}
                        transition={{
                          duration: 0.35,
                          ease: [0.6, 0.6, 0, 1],
                          delay: 0.34,
                        }}
                        className="origin-left"
                      >
                        <div
                          ref={pillRef}
                          className="flex h-28 items-center gap-8 rounded-full bg-background-faint py-6 pr-12 pl-6"
                        >
                          <Icon
                            name="loader"
                            size={16}
                            className="shrink-0 animate-spin text-icon-muted [animation-duration:0.7s] [animation-timing-function:steps(8)]"
                          />

                          <ScatterText
                            className="block text-body-tiny text-text-base"
                            stagger="sequence"
                            text={run.kind.steps[step]}
                          />
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-220 bg-linear-to-b from-transparent from-10% to-background-base to-60% mask-[linear-gradient(to_left,transparent_0%,black_35.73%)]" />
      </HeroWindow>

      <EmailPreview
        email={active.kind}
        ghosts={active.ghosts}
        reveal={reveal}
        sent={settled}
        started={started}
      />
    </div>
  );
}
