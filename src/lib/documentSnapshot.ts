import type { ComponentInstance, GridConfig } from "../grid/types";

/** Inner zustand `partialize` document slice (not the `{ state, version }` envelope). */
export type BuilderDocumentSnapshot = {
  gridConfig: GridConfig;
  instances: ComponentInstance[];
  nextInstanceIndex: number;
  selectedInstanceId: string | null;
  canvasPan: { x: number; y: number };
};

export type BuilderDocumentSnapshotSource = {
  gridConfig: GridConfig;
  instances: ComponentInstance[];
  nextInstanceIndex: number;
  selectedInstanceId: string | null;
  canvasPan: { x: number; y: number };
};

export const getBuilderDocumentSnapshot = (state: BuilderDocumentSnapshotSource): BuilderDocumentSnapshot => ({
  gridConfig: state.gridConfig,
  instances: state.instances,
  nextInstanceIndex: state.nextInstanceIndex,
  selectedInstanceId: state.selectedInstanceId,
  canvasPan: state.canvasPan,
});

export const serializeBuilderDocumentSnapshot = (snapshot: BuilderDocumentSnapshot): string =>
  JSON.stringify(snapshot, null, 2);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Parses pasted JSON; unwraps zustand persist envelope `{ state, version }` when present. */
export const parseBuilderDocumentSnapshotInput = (text: string): unknown => {
  const parsed: unknown = JSON.parse(text);
  if (isRecord(parsed) && "state" in parsed) {
    return parsed.state;
  }
  return parsed;
};

export const copyBuilderDocumentSnapshotToClipboard = async (snapshot: BuilderDocumentSnapshot): Promise<boolean> => {
  const text = serializeBuilderDocumentSnapshot(snapshot);
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
