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

export const useAppShortcuts = () => {
  const deleteInstance = useAppStore((s) => s.deleteInstance);
  const duplicateSelectedInstance = useAppStore((s) => s.duplicateSelectedInstance);
  const undoDocument = useAppStore((s) => s.undoDocument);
  const redoDocument = useAppStore((s) => s.redoDocument);
  const cancelConnectorEndpointPick = useAppStore((s) => s.cancelConnectorEndpointPick);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);

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

  useHotkeys(
    "meta+equal,ctrl+equal",
    () => {
      resetCanvasZoom();
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
      enabled: canUseDocumentShortcut,
      preventDefault: canUseDocumentShortcut,
    },
    [resetCanvasZoom],
  );
};
