import { useEffect, useRef, useState } from "react";

import { observeVisibility } from "@/utils/visibility-timers";

import { ACTS, PROGRESS, type Stage } from "./acts";
import PreviewWindow from "./PreviewWindow";
import Terminal from "./Terminal";

export default function SandboxRun() {
  const [actIndex, setActIndex] = useState(0);
  const [printed, setPrinted] = useState(0);
  const [typing, setTyping] = useState<{
    index: number;
    chars: number;
  } | null>(null);
  const [stage, setStage] = useState<Stage>(ACTS[0].opening);
  const [stageIndex, setStageIndex] = useState(0);
  const [live, setLive] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const act = ACTS[actIndex];

  useEffect(() => {
    const lines = act.blocks.flatMap((block) =>
      block.map((line, index) => ({ line, last: index === block.length - 1 }))
    );

    let cancelled = false;
    let visible = false;
    let resume: (() => void) | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const pending = new Set<() => void>();

    const stopObserving = observeVisibility(rootRef.current!, 0, (next) => {
      visible = next;
      setIsVisible(next);
      if (!next || !resume) return;
      const go = resume;
      resume = null;
      pending.delete(go);
      go();
    });

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          pending.delete(resolve);
          resolve();
        }, ms);
        timers.add(timer);
        pending.add(resolve);
      }).then(() =>
        visible
          ? undefined
          : new Promise<void>((resolve) => {
              resume = resolve;
              pending.add(resolve);
            })
      );

    const run = async () => {
      setPrinted(0);
      setTyping(null);
      setLive(false);
      setStage(act.opening);
      setStageIndex(0);

      await wait(900);

      for (let index = 0; index < lines.length; index += 1) {
        const { line, last } = lines[index];
        if (cancelled) return;

        if (line.kind === "command") {
          for (let chars = 1; chars <= line.text.length; chars += 1) {
            setTyping({ index, chars });
            await wait(46);
            if (cancelled) return;
          }

          await wait(300);
          if (cancelled) return;
          setTyping(null);
        }

        setPrinted(index + 1);

        if (line.stage === "live") {
          setStageIndex(PROGRESS.length - 1);
          await wait(420);
          if (cancelled) return;
          setLive(true);
        } else if (line.stage) {
          setStage(line.stage);
          setStageIndex((current) => current + 1);
        }

        if (line.kind === "check") await wait(430);
        else if (line.kind === "link") await wait(340);
        else await wait(195);

        if (last) await wait(185);
      }

      await wait(3900);
      if (cancelled) return;

      const next = (actIndex + 1) % ACTS.length;
      setPrinted(0);
      setTyping(null);
      setLive(false);
      setStage(ACTS[next].opening);
      setStageIndex(0);
      setActIndex(next);
    };

    void run();

    return () => {
      cancelled = true;
      stopObserving();
      for (const timer of timers) clearTimeout(timer);
      // Release anything parked on a cleared timer or the visibility gate, so
      // the run reaches its `cancelled` check instead of suspending forever.
      for (const release of pending) release();
      pending.clear();
      resume = null;
    };
  }, [act]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-run-surface=""
      data-visible={isVisible ? "" : undefined}
      className="pointer-events-none absolute inset-0"
    >
      <Terminal act={act} printed={printed} typing={typing} />

      <PreviewWindow
        act={act}
        stage={stage}
        stageIndex={stageIndex}
        live={live}
      />
    </div>
  );
}
