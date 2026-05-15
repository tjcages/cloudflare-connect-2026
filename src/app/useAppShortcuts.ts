import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAppStore } from "../store";

const isEditableEventTarget = (target: EventTarget | null) =>
  target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']") !== null;

const canUseDocumentShortcut = (event: KeyboardEvent) =>
  !isEditableEventTarget(event.target) && useAppStore.getState().dragState === null;

const canDeleteSelected = (event: KeyboardEvent) =>
  canUseDocumentShortcut(event) && useAppStore.getState().selectedInstanceId !== null;

const canDuplicateSelected = canDeleteSelected;

const canUndoDocument = (event: KeyboardEvent) =>
  canUseDocumentShortcut(event) && useAppStore.temporal.getState().pastStates.length > 0;

const canRedoDocument = (event: KeyboardEvent) =>
  canUseDocumentShortcut(event) && useAppStore.temporal.getState().futureStates.length > 0;

/**
 * ⌘/Ctrl + reset-zoom chord: "=" / Equal / numpad =, plus layout aliases:
 * Turkish and other layouts often use ⌘+0 where US uses ⌘+= for “actual size”.
 */
const shouldHandleCanvasZoomResetKey = (event: KeyboardEvent) => {
  if (event.code === "NumpadEqual") {
    return true;
  }
  if (event.key === "=") {
    return true;
  }
  if (event.code === "Equal" && !event.shiftKey) {
    return true;
  }
  // Turkish Q et al.: top-row 0 with modifier matches “reset zoom” where US uses "=" .
  if ((event.code === "Digit0" || event.code === "Numpad0") && !event.shiftKey) {
    return true;
  }

  const kc = "keyCode" in event ? (event as KeyboardEvent & { keyCode?: number }).keyCode : undefined;
  // 187: common for `=` / `+` key; 61: legacy — require !shift so "+" doesn't reset zoom.
  if ((kc === 187 || kc === 61) && !event.shiftKey) {
    return true;
  }
  if (kc === 48 && !event.shiftKey) {
    return true;
  }
  return false;
};

export const useAppShortcuts = () => {
  const deleteInstance = useAppStore((s) => s.deleteInstance);
  const duplicateSelectedInstance = useAppStore((s) => s.duplicateSelectedInstance);
  const undoDocument = useAppStore((s) => s.undoDocument);
  const redoDocument = useAppStore((s) => s.redoDocument);
  const cancelConnectorEndpointPick = useAppStore((s) => s.cancelConnectorEndpointPick);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || !shouldHandleCanvasZoomResetKey(event)) {
        return;
      }
      if (!canUseDocumentShortcut(event)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      resetCanvasZoom();
    };

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [resetCanvasZoom]);

  useHotkeys(
    "delete,backspace",
    (event) => {
      if (!canDeleteSelected(event)) {
        return;
      }
      const id = useAppStore.getState().selectedInstanceId;
      if (id === null) {
        return;
      }
      deleteInstance(id);
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
      enabled: canDeleteSelected,
      preventDefault: canDeleteSelected,
    },
    [deleteInstance],
  );

  useHotkeys(
    "ctrl+d,meta+d",
    () => {
      duplicateSelectedInstance();
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
      enabled: canDuplicateSelected,
      preventDefault: canDuplicateSelected,
    },
    [duplicateSelectedInstance],
  );

  useHotkeys(
    "ctrl+shift+z,meta+shift+z",
    () => {
      redoDocument();
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
      enabled: canRedoDocument,
      preventDefault: canRedoDocument,
    },
    [redoDocument],
  );

  useHotkeys(
    "ctrl+z,meta+z",
    () => {
      undoDocument();
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
      enabled: canUndoDocument,
      preventDefault: canUndoDocument,
    },
    [undoDocument],
  );

  useHotkeys(
    "escape",
    () => {
      cancelConnectorEndpointPick();
    },
    {
      enabled: () => useAppStore.getState().connectorEndpointPick !== null,
    },
    [cancelConnectorEndpointPick],
  );
};
