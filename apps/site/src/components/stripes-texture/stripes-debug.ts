import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stripes-debug";

const returnFalse = () => false;
const noop = () => {};

let stripesOff = false;
let statsOpen = false;
let restored = false;

const listeners = new Set<() => void>();

function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    stripesOff = parsed?.stripesOff === true;
    statsOpen = parsed?.statsOpen === true;
  } catch {
    stripesOff = false;
    statsOpen = false;
  }
}

function emit() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stripesOff, statsOpen })
    );
  } catch {
    restored = true;
  }
  for (const listener of listeners) listener();
}

function onKeyDown(event: KeyboardEvent) {
  if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  )
    return;
  if (event.code === "KeyD") statsOpen = !statsOpen;
  else if (event.code === "KeyS") stripesOff = !stripesOff;
  else return;
  emit();
}

const subscribe: (onStoreChange: () => void) => () => void = import.meta.env.DEV
  ? (onStoreChange) => {
      restore();
      if (listeners.size === 0) window.addEventListener("keydown", onKeyDown);
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0)
          window.removeEventListener("keydown", onKeyDown);
      };
    }
  : () => noop;

const getStripesOff = import.meta.env.DEV ? () => stripesOff : returnFalse;
const getStatsOpen = import.meta.env.DEV ? () => statsOpen : returnFalse;

export function useStripesOff() {
  return useSyncExternalStore(subscribe, getStripesOff, returnFalse);
}

export function useStripesStatsOpen() {
  return useSyncExternalStore(subscribe, getStatsOpen, returnFalse);
}
