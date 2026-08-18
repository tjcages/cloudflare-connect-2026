import { LevaPanel, useControls, useCreateStore } from "leva";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./panel.css";
import "./connect-panel.css";
import { cn } from "./cn";
import { LAB_LEVA_THEME } from "./levaTheme";
import {
  HINT_SIDES,
  RESIZE_DIRS,
  usePanelDragResize,
} from "./usePanelDragResize";

export type LevaStore = ReturnType<typeof useCreateStore>;

/**
 * Bind one Leva store to one shader target. Called once per target and never
 * conditionally, so every target keeps a live store while only the selected
 * one is rendered — switching targets never resets the others.
 */
export function useLevaTarget<T>(
  buildSchema: () => Record<string, unknown>,
  fromValues: (values: Record<string, unknown>) => T,
  onChange: (next: T) => void
): LevaStore {
  // Pin the store across HMR, matching the lab: Fast Refresh recomputes
  // useCreateStore while leva's useControls keeps writing to the original.
  const [store] = useState(useCreateStore());
  // leva's `Schema` type is not exported, so the schema builders are typed
  // structurally and reconciled here at the single boundary.
  const [values] = useControls(
    buildSchema as Parameters<typeof useControls>[0],
    { store }
  ) as unknown as [Record<string, unknown>];

  const onChangeRef = useRef(onChange);
  const fromValuesRef = useRef(fromValues);
  onChangeRef.current = onChange;
  fromValuesRef.current = fromValues;

  useEffect(() => {
    onChangeRef.current(fromValuesRef.current(values));
  }, [values]);

  return store;
}

export function ConnectLevaPanel({
  store,
  titleSlot,
  onClose,
}: {
  store: LevaStore;
  titleSlot?: ReactNode;
  onClose: () => void;
}) {
  // The hero this island lives in is `isolate` + `overflow-hidden`, which traps
  // a fixed-position child in its stacking context and clips it. Portal to
  // <body> so the panel always paints above the page, whatever it is mounted
  // inside — the panel this replaced portaled to <body> too.
  const { panelRef, onHeaderPointerDown, onResizePointerDown } =
    usePanelDragResize();

  // Arm the bottom fade mask while more content is cut off below the fold.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = bodyRef.current;
    if (!sc) return;
    const update = () =>
      sc.classList.toggle(
        "connect-leva-panel__body--cut-off",
        sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1
      );
    update();
    sc.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(sc);
    // The leva root grows/shrinks as folders toggle.
    if (sc.firstElementChild) ro.observe(sc.firstElementChild);
    return () => {
      sc.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const panel = (
    // `playground-leva-panel` is what every lifted lab selector is scoped to.
    <div className="connect-leva-panel playground-leva-panel" ref={panelRef}>
      {/* Before the header on purpose: lab CSS keys off `> div:last-child`. */}
      {RESIZE_DIRS.map((dir) => (
        <div
          className={cn([
            "connect-leva-panel__resize",
            `connect-leva-panel__resize--${dir}`,
          ])}
          key={dir}
          onPointerDown={(e) => onResizePointerDown(e, dir)}
        />
      ))}
      {HINT_SIDES.map((side) => (
        <div
          aria-hidden
          className={cn([
            "connect-leva-panel__hint",
            `connect-leva-panel__hint--${side}`,
          ])}
          key={side}
        />
      ))}
      <div
        className="connect-leva-panel__header"
        onPointerDown={onHeaderPointerDown}
      >
        {titleSlot}
        <button
          aria-label="Close shader controls"
          className="connect-leva-panel__close"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden viewBox="0 0 12 12">
            <path d="m3 3 6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
      {/*
        The lab's rules assume leva's root is the panel's direct last child
        (`.playground-leva-panel > div:last-child` un-fixes and un-caps it), so
        the scroller carries the class too. Without it leva's root stays
        stretched to the scroller's height and its content spills instead of
        scrolling.
      */}
      <div
        className="connect-leva-panel__body playground-leva-panel"
        ref={bodyRef}
      >
        <LevaPanel
          store={store}
          theme={LAB_LEVA_THEME}
          fill
          flat
          titleBar={false}
        />
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
