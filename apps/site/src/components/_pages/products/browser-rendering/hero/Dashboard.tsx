import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import HeroWindow from "@/components/HeroWindow";
import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";
import RunStatus from "@/components/run-status/RunStatus";
import type { IslandProps } from "@/types/island-props";
import { observeVisibility } from "@/utils/visibility-timers";

import type { ActId, ThemeShots } from "./acts";
import { ACTS, DEFAULT_RUN_MS } from "./acts";
import LiveView from "./LiveView";

interface Run {
  key: number;
  title: string;
  subtitle: string;
  icon: IconName;
  method: string;
  act: ActId;
  id: string;
  running?: boolean;
}

const RUN_TYPES = [
  {
    title: "Screenshot",
    subtitle: "Quick Action",
    icon: "focus-exposure",
    method: "REST API",
    act: "screenshot",
  },
  {
    title: "Playwright Session",
    subtitle: "Browser Session",
    icon: "cursor-click",
    method: "Worker",
    act: "playwright",
  },
  {
    title: "Markdown",
    subtitle: "Quick Action",
    icon: "markdown",
    method: "Worker",
    act: "markdown",
  },
  {
    title: "Crawl",
    subtitle: "Quick Action",
    icon: "arrows-all-sides-2",
    method: "REST API",
    act: "crawl",
  },
  {
    title: "JSON Extract",
    subtitle: "Quick Action",
    icon: "brackets-2",
    method: "JSON Endpoint",
    act: "json",
  },
] as const satisfies readonly {
  title: string;
  subtitle: string;
  icon: IconName;
  method: string;
  act: ActId;
}[];

const INITIAL_RUNS: Run[] = [
  { key: 0, ...RUN_TYPES[0], id: "a47f21b0-85d1", running: true },
  { key: 1, ...RUN_TYPES[1], id: "c91d7ab6" },
  { key: 2, ...RUN_TYPES[2], id: "8d70d531" },
  { key: 3, ...RUN_TYPES[3], id: "e3a6b9c2-3" },
  { key: 4, ...RUN_TYPES[4], id: "1f7e2d90" },
];

export default function Dashboard({
  shots,
}: IslandProps<{ shots: ThemeShots }>) {
  const [runs, setRuns] = useState<Run[]>(INITIAL_RUNS);
  const active = runs.find((run) => run.running) ?? runs[0];
  const [entered, setEntered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(INITIAL_RUNS.length);
  const typeRef = useRef(1);
  const actCompleteRef = useRef<(act: ActId) => void>(() => undefined);
  const handleActComplete = useCallback(
    (act: ActId) => actCompleteRef.current(act),
    []
  );

  useEffect(() => {
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let step = 0;
    let currentAct: ActId = INITIAL_RUNS[0].act;
    let runFor = ACTS[currentAct].runFor ?? DEFAULT_RUN_MS;
    let surfaceDone = false;
    let settling = false;

    const advance = () => {
      setEntered(true);
      if (step === 0) {
        setRuns((rs) =>
          rs.map((r, i) => (i === 0 ? { ...r, running: false } : r))
        );
      } else {
        const type = RUN_TYPES[typeRef.current];
        currentAct = type.act;
        runFor = ACTS[currentAct].runFor ?? DEFAULT_RUN_MS;
        surfaceDone = false;
        typeRef.current = (typeRef.current + 1) % RUN_TYPES.length;
        const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
          b.toString(16).padStart(2, "0")
        ).join("");
        const key = keyRef.current++;
        setRuns((rs) =>
          [
            {
              key,
              ...type,
              id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}`,
              running: true,
            },
            ...rs,
          ].slice(0, 6)
        );
      }
      step = 1 - step;
      queue();
    };

    const settleSurface = (delay: number) => {
      if (settling) return;
      settling = true;
      timer = setTimeout(() => {
        settling = false;
        advance();
      }, delay);
    };

    const queue = () => {
      clearTimeout(timer);
      settling = false;
      if (!visible) return;
      const completeAfterSurface = ACTS[currentAct].completeAfterSurface;
      if (step === 0 && completeAfterSurface !== undefined) {
        if (surfaceDone) settleSurface(completeAfterSurface);
        return;
      }
      timer = setTimeout(advance, step === 0 ? runFor : 1000);
    };

    actCompleteRef.current = (act) => {
      const completeAfterSurface = ACTS[act].completeAfterSurface;
      if (
        step !== 0 ||
        act !== currentAct ||
        completeAfterSurface === undefined
      )
        return;
      surfaceDone = true;
      if (visible) settleSurface(completeAfterSurface);
    };

    const stopObserving = observeVisibility(rootRef.current!, 0, (next) => {
      visible = next;
      setIsVisible(next);
      queue();
    });

    return () => {
      stopObserving();
      clearTimeout(timer);
      actCompleteRef.current = () => undefined;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-run-surface=""
      data-visible={isVisible ? "" : undefined}
      className="pointer-events-none absolute inset-0"
    >
      <HeroWindow variant="primary">
        <div className="relative z-20 flex h-56 items-center justify-between bg-background-base pr-12 pl-20 before:inside-border-b before:border-border-muted">
          <div className="flex items-center gap-12">
            <Icon
              name="product-browser-run"
              variant="duo"
              color="orange"
              size={20}
            />
            <span className="text-label-x-small text-text-base">
              Browser Run
            </span>
          </div>
          <div className="flex rounded-8 bg-background-faint p-2">
            <span className="rounded-6 px-12 py-4 text-label-x-small text-text-muted">
              Overview
            </span>
            <span className="rounded-6 bg-background-base px-12 py-4 text-label-x-small text-text-base shadow-elevation-default">
              Runs
            </span>
            <span className="rounded-6 px-12 py-4 text-label-x-small text-text-muted">
              Live Sessions
            </span>
          </div>
        </div>

        <div className="relative z-10 flex h-44 items-center gap-12 bg-background-surface px-20 text-body-x-small text-text-muted before:inside-border-b before:border-border-default">
          <span className="w-148">Type</span>
          <span className="w-120">Status</span>
          <span className="w-88">Method</span>
          <span className="min-w-0 flex-1">ID</span>
        </div>

        <div className="relative h-300">
          {runs.map((run, index) => (
            <motion.div
              key={run.key}
              initial={
                run.key < INITIAL_RUNS.length
                  ? { y: index * 80 + 8, opacity: 0, filter: "blur(2px)" }
                  : { y: -80, opacity: 0, filter: "blur(0px)" }
              }
              animate={{ y: index * 80, opacity: 1, filter: "blur(0px)" }}
              transition={
                entered
                  ? { duration: 0.45, ease: [0.6, 0.6, 0, 1] }
                  : {
                      duration: 0.35,
                      ease: [0.6, 0.6, 0, 1],
                      delay: 0.2 + run.key * 0.07,
                    }
              }
              className="absolute inset-x-0 top-0 flex h-80 items-start gap-12 p-20 before:inside-border-b before:border-border-default"
            >
              <div className="flex w-148 items-start gap-12">
                <Icon
                  name={run.icon}
                  size={20}
                  className="shrink-0 text-icon-default"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body-x-small text-text-base">
                    {run.title}
                  </span>
                  <span className="truncate text-body-x-small text-text-muted">
                    {run.subtitle}
                  </span>
                </div>
              </div>
              <div className="w-120">
                <RunStatus
                  doneLabel="Completed"
                  running={Boolean(run.running)}
                  tone="info"
                />
              </div>
              <span className="w-88 truncate text-body-x-small text-text-muted">
                {run.method}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-x-small text-text-muted">
                {run.id}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-220 bg-linear-to-b from-transparent from-10% to-background-base to-60% mask-[linear-gradient(to_left,transparent_0%,black_35.73%)]" />
      </HeroWindow>

      {isVisible && (
        <LiveView
          act={active.act}
          onActComplete={handleActComplete}
          running={Boolean(active.running)}
          shots={shots}
        />
      )}
    </div>
  );
}
