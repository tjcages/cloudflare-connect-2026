import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import HeroWindow from "@/components/HeroWindow";
import Icon from "@/components/icon/Icon";
import Scramble from "@/components/scramble/Scramble";

import type { ActId, Surface as SurfaceType, ThemeShots } from "./acts";
import { ACTS, JSON_LINES, MARKDOWN_LINES } from "./acts";
import CornerTick from "./_svg/CornerTick.svg?react";
import Cursor from "./_svg/Cursor.svg?react";
import "./LiveView.css";

interface Props {
  act: ActId;
  onActComplete: (act: ActId) => void;
  running: boolean;
  shots: ThemeShots;
}

const subscribeTheme = (onStoreChange: () => void) => {
  addEventListener("themechange", onStoreChange);
  return () => removeEventListener("themechange", onStoreChange);
};

const getTheme = (): keyof ThemeShots =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const getServerTheme = (): keyof ThemeShots => "light";

const CAPTURE_TRANSITION_MS = 720;

export default function LiveView({
  act: actId,
  onActComplete,
  running,
  shots,
}: Props) {
  const act = ACTS[actId];
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const handleSurfaceComplete = useCallback(
    () => onActComplete(actId),
    [actId, onActComplete]
  );
  const [beatIndex, setBeatIndex] = useState(0);
  const [prevActId, setPrevActId] = useState(actId);
  const [flash, setFlash] = useState(false);
  const [nip, setNip] = useState(false);
  const cursorX = act.cursor?.path.map(([x]) => x);
  const cursorY = act.cursor?.path.map(([, y]) => y);
  const cursorTarget = act.cursor?.path[act.cursor.path.length - 1];

  let resolvedIndex = beatIndex;
  if (prevActId !== actId) {
    setPrevActId(actId);
    setBeatIndex(0);
    resolvedIndex = 0;
  }
  const surfaceKey =
    actId === "screenshot" || actId === "playwright"
      ? "browser-session"
      : `${actId}-${resolvedIndex}`;

  useEffect(() => {
    const timers = act.beats
      .slice(1)
      .map((beat, index) => setTimeout(() => setBeatIndex(index + 1), beat.at));
    return () => timers.forEach(clearTimeout);
  }, [act]);

  useEffect(() => {
    if (act.flashAt === undefined) return;
    const timers = [
      setTimeout(() => setNip(true), act.flashAt),
      setTimeout(() => setFlash(true), act.flashAt + 60),
      setTimeout(
        () => setFlash(false),
        act.flashAt + 60 + CAPTURE_TRANSITION_MS
      ),
    ];
    return () => {
      timers.forEach(clearTimeout);
      setFlash(false);
      setNip(false);
    };
  }, [act]);

  const beat = act.beats[resolvedIndex];

  return (
    <HeroWindow variant="preview">
      <motion.span
        animate={nip ? { x: [0, 3, 0], y: [0, 3, 0] } : { x: 0, y: 0 }}
        transition={{
          duration: CAPTURE_TRANSITION_MS / 1000,
          times: [0, 0.26, 1],
          ease: [0.6, 0.6, 0, 1],
        }}
        className="absolute -top-16 -left-16 size-16"
      >
        <CornerTick aria-hidden className="size-16 text-darker/6" />
      </motion.span>
      <motion.span
        animate={nip ? { x: [0, -3, 0], y: [0, 3, 0] } : { x: 0, y: 0 }}
        transition={{
          duration: CAPTURE_TRANSITION_MS / 1000,
          times: [0, 0.26, 1],
          ease: [0.6, 0.6, 0, 1],
        }}
        className="absolute -top-16 -right-16 size-16"
      >
        <CornerTick aria-hidden className="size-16 rotate-90 text-darker/6" />
      </motion.span>
      <motion.span
        animate={nip ? { x: [0, 3, 0], y: [0, -3, 0] } : { x: 0, y: 0 }}
        transition={{
          duration: CAPTURE_TRANSITION_MS / 1000,
          times: [0, 0.26, 1],
          ease: [0.6, 0.6, 0, 1],
        }}
        className="absolute -bottom-16 -left-16 size-16"
      >
        <CornerTick aria-hidden className="size-16 -rotate-90 text-darker/6" />
      </motion.span>
      <motion.span
        animate={nip ? { x: [0, -3, 0], y: [0, -3, 0] } : { x: 0, y: 0 }}
        transition={{
          duration: CAPTURE_TRANSITION_MS / 1000,
          times: [0, 0.26, 1],
          ease: [0.6, 0.6, 0, 1],
        }}
        className="absolute -right-16 -bottom-16 size-16"
      >
        <CornerTick aria-hidden className="size-16 rotate-180 text-darker/6" />
      </motion.span>
      <div className="relative size-full overflow-clip bg-background-base shadow-elevation-default">
        <AnimatePresence>
          {flash && (
            <motion.div
              key="flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: CAPTURE_TRANSITION_MS / 1000,
                times: [0, 0.04, 0.28, 1],
                ease: [0.165, 0.84, 0.44, 1],
              }}
              className="live-flash pointer-events-none absolute inset-0 z-40"
            />
          )}
        </AnimatePresence>

        <div className="flex h-48 items-center justify-between px-16">
          <div className="flex items-center gap-12">
            <div className="flex w-40 items-center justify-center gap-6">
              <span className="size-6 rounded-full bg-orange-900" />
              <span className="size-6 rounded-full bg-orange-800" />
              <span className="size-6 rounded-full bg-green-900" />
            </div>
            <div className="flex items-center gap-6 rounded-full bg-background-faint py-4 pr-10 pl-8">
              <Icon
                name="cloudflare"
                variant="duo"
                color="orange"
                className="h-16 w-24"
              />
              <span className="max-w-140 truncate text-label-tiny text-text-base">
                Cloudflare: Build for the agent era
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="relative flex-center size-16">
              {running && (
                <motion.span
                  initial={{ scale: 0, opacity: 0.5 }}
                  animate={{
                    scale: 1,
                    opacity: [0.5, 0.5, 0],
                  }}
                  transition={{
                    duration: 1.8,
                    ease: [0.165, 0.84, 0.44, 1],
                    repeat: Infinity,
                    repeatDelay: 0.6,
                    opacity: {
                      duration: 1.8,
                      times: [0, 0.35, 1],
                      ease: [0.165, 0.84, 0.44, 1],
                      repeat: Infinity,
                      repeatDelay: 0.6,
                    },
                  }}
                  className="absolute inset-0 m-auto size-15 rounded-full shadow-[0_0_0_1px_var(--color-icon-accent-success)]"
                />
              )}
              <span className="relative z-10 size-6 rounded-full bg-icon-accent-success" />
            </span>
            <span className="text-label-tiny text-text-accent-success">
              Live View
            </span>
          </div>
        </div>
        <div className="relative mx-6 h-196 overflow-clip bg-background-base before:pointer-events-none before:absolute before:inset-0 before:z-10 before:shadow-[inset_0_0_0_1px_var(--color-border-default)]">
          <AnimatePresence initial={false}>
            <motion.div
              key={surfaceKey}
              initial={{ y: -96, opacity: 0, filter: "blur(3px)", zIndex: 1 }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)", zIndex: 1 }}
              exit={{
                y: 96,
                opacity: 0,
                filter: "blur(3px)",
                zIndex: 2,
              }}
              transition={{ duration: 0.42, ease: [0.165, 0.84, 0.44, 1] }}
              className="absolute inset-0"
            >
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: act.scroll ? act.scroll.to : 0 }}
                transition={{
                  duration: act.scroll?.duration ?? 0,
                  ease: [0.6, 0.6, 0, 1],
                  delay: act.scroll ? act.scroll.at / 1000 : 0,
                }}
                className={
                  act.scroll ? "absolute inset-x-0 top-0" : "absolute inset-0"
                }
              >
                <Surface
                  onComplete={handleSurfaceComplete}
                  surface={beat.surface}
                  shots={shots[theme]}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {act.cursor && (
            <motion.span
              key={`cursor-${actId}`}
              initial={{
                x: act.cursor.path[0][0],
                y: act.cursor.path[0][1],
                opacity: 1,
              }}
              animate={{ x: cursorX, y: cursorY }}
              transition={{
                duration: act.cursor.duration,
                times: act.cursor.times,
                ease: [0.455, 0.03, 0.515, 0.955],
                delay: act.cursor.start / 1000,
              }}
              className="pointer-events-none absolute top-0 left-0 z-30"
            >
              <Cursor aria-hidden className="size-13" />
            </motion.span>
          )}

          {act.cursor && cursorTarget && (
            <motion.span
              key={`click-${actId}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.4, 0.75, 2.4] }}
              transition={{
                duration: 0.8,
                times: [0, 0.18, 1],
                ease: [0.6, 0.6, 0, 1],
                delay: act.cursor.clickAt / 1000,
              }}
              style={{
                left: cursorTarget[0],
                top: cursorTarget[1],
              }}
              className="pointer-events-none absolute z-20 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-900/40 shadow-[0_0_0_2px_var(--color-orange-900)]"
            />
          )}

          {act.scan && (
            <motion.div
              key={`scan-${actId}-${resolvedIndex}`}
              initial={{ y: -109, opacity: 0 }}
              animate={{ y: 196, opacity: 1 }}
              transition={{
                duration: act.scan.duration,
                ease: [0.6, 0.6, 0, 1],
                delay: act.scan.delay,
                opacity: {
                  duration: 0.08,
                  ease: [0.165, 0.84, 0.44, 1],
                  delay: act.scan.delay,
                },
              }}
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-109 bg-linear-to-b from-transparent from-35% to-orange-900/24 after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-orange-900"
            />
          )}
        </div>
      </div>
    </HeroWindow>
  );
}

function Surface({
  onComplete,
  surface,
  shots,
}: {
  onComplete: () => void;
  surface: SurfaceType;
  shots: ThemeShots["light"];
}) {
  if (surface.kind === "page") {
    return surface.tall ? (
      <img src={shots[surface.page]} alt="" className="w-full" />
    ) : (
      <img
        src={shots[surface.page]}
        alt=""
        className="size-full object-cover object-top"
      />
    );
  }

  if (surface.kind === "markdown") {
    return (
      <div className="size-full bg-background-base px-12 py-8 font-mono text-[8px]/[11px]">
        {MARKDOWN_LINES.map((line, index) => (
          <ScrambleLine
            key={index}
            text={line.text}
            delay={300 + index * 95}
            className={
              line.tone === "heading"
                ? "text-text-base"
                : line.tone === "link"
                  ? "text-text-accent-orange"
                  : "text-text-muted"
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="size-full bg-background-base px-12 py-8 font-mono text-[8px]/[11px] whitespace-pre">
      {JSON_LINES.map((line, index) => (
        <ScrambleLine
          key={index}
          text={line.text}
          delay={300 + index * 130}
          onComplete={index === JSON_LINES.length - 1 ? onComplete : undefined}
          className={
            line.tone === "punct" ? "text-text-muted" : "text-text-base"
          }
        />
      ))}
    </div>
  );
}

function ScrambleLine({
  text,
  delay,
  onComplete,
  className,
}: {
  text: string;
  delay: number;
  onComplete?: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!armed || text === "") {
    return <div className={className}>&nbsp;</div>;
  }

  return (
    <Scramble
      text={text}
      preset="hex-fast"
      onComplete={onComplete}
      className={className}
    />
  );
}
