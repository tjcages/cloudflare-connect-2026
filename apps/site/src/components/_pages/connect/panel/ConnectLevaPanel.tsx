import { LevaPanel, useControls, useCreateStore } from "leva";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./panel.css";
import "./connect-panel.css";
import { LAB_LEVA_THEME } from "./levaTheme";

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
  const panel = (
    // `playground-leva-panel` is what every lifted lab selector is scoped to.
    <div className="connect-leva-panel playground-leva-panel">
      <div className="connect-leva-panel__header">
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
      <div className="connect-leva-panel__body">
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
