import { type RefObject, useEffect, useRef, useState } from "react";

const retainedByRoot = new WeakMap<Element, Map<string, unknown>>();

function retainedKey(event: string, detail: unknown) {
  if (detail && typeof detail === "object" && "row" in detail) {
    return `${event}:${(detail as { row: unknown }).row}`;
  }
  return event;
}

export function dispatchIllustrationEvent<T>(
  root: HTMLElement,
  event: string,
  detail: T
) {
  let channels = retainedByRoot.get(root);
  if (!channels) {
    channels = new Map();
    retainedByRoot.set(root, channels);
  }
  channels.set(retainedKey(event, detail), detail);
  root.dispatchEvent(new CustomEvent(event, { detail }));
}

export function useIllustrationEvent<T>(
  ref: RefObject<HTMLElement | null>,
  event: string,
  onDetail: (detail: T) => void
) {
  const handler = useRef(onDetail);
  handler.current = onDetail;

  useEffect(() => {
    const root = ref.current?.closest("[data-illustration-root]");
    if (!root) return;
    const listener = (e: Event) =>
      handler.current((e as CustomEvent<T>).detail);
    root.addEventListener(event, listener);

    const channels = retainedByRoot.get(root);
    if (channels) {
      for (const [key, detail] of channels) {
        if (key === event || key.startsWith(`${event}:`)) {
          handler.current(detail as T);
        }
      }
    }

    return () => root.removeEventListener(event, listener);
  }, [ref, event]);
}

export function useIllustrationIndex(
  ref: RefObject<HTMLElement | null>,
  event: string
) {
  const [index, setIndex] = useState(0);
  useIllustrationEvent<{ index: number }>(ref, event, (d) => setIndex(d.index));
  return index;
}
