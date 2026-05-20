import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import { parseBuilderDocumentSnapshotInput, serializeBuilderDocumentSnapshot } from "../lib/documentSnapshot";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { ShareSidebar } from "./ShareSidebar";

describe("ShareSidebar", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("copies the current document snapshot to the clipboard", async () => {
    useAppStore.setState({ gridConfig: { ...DEFAULT_CONFIG, seed: "copy-me" } });
    render(<ShareSidebar />);

    fireEvent.click(screen.getByTestId("share-copy-state"));

    const writeText = navigator.clipboard!.writeText as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const snapshot = (await parseBuilderDocumentSnapshotInput(writeText.mock.calls[0][0] as string)) as {
      gridConfig: { seed: string };
    };
    expect(snapshot.gridConfig.seed).toBe("copy-me");
    expect(screen.getByTestId("share-copy-state")).toHaveTextContent("Copied");
  });

  it("imports a pasted snapshot into the store", async () => {
    const snapshot = {
      gridConfig: { ...DEFAULT_CONFIG, seed: "imported-seed", density: 0.99 },
      instances: [],
      nextInstanceIndex: 2,
      selectedInstanceId: null,
      canvasPan: { x: 0, y: 0 },
    };

    render(<ShareSidebar />);
    fireEvent.change(screen.getByTestId("share-import-textarea"), {
      target: { value: serializeBuilderDocumentSnapshot(snapshot) },
    });
    fireEvent.click(screen.getByTestId("share-import-state"));

    await waitFor(() => {
      expect(useAppStore.getState().gridConfig.seed).toBe("imported-seed");
      expect(useAppStore.getState().gridConfig.density).toBe(0.99);
    });
    expect(screen.getByTestId("share-import-textarea")).toHaveValue("");
    expect(screen.getByTestId("share-import-status")).toHaveTextContent("Imported");
  });

  it("shows import failed for invalid JSON", async () => {
    render(<ShareSidebar />);
    fireEvent.change(screen.getByTestId("share-import-textarea"), { target: { value: "not-json" } });
    fireEvent.click(screen.getByTestId("share-import-state"));

    await waitFor(() => {
      expect(screen.getByTestId("share-import-status")).toHaveTextContent("Import failed");
    });
  });
});
