import type { Ref } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyDocumentPng } from "../canvas/pngExport";
import type { ComponentInstance } from "../grid/types";
import { DEFAULT_ICON_ID } from "../lib/iconRegistry";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { App } from "./App";

vi.mock("../canvas/pngExport", () => ({
  copyDocumentPng: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../canvas", () => ({
  GridCanvas: ({ canvasRef }: { canvasRef?: Ref<HTMLCanvasElement | null> }) => (
    <div
      data-testid="builder-canvas"
      ref={(node) => {
        if (!canvasRef) {
          return;
        }
        if (typeof canvasRef === "function") {
          canvasRef(node as unknown as HTMLCanvasElement);
        } else {
          canvasRef.current = node as unknown as HTMLCanvasElement;
        }
      }}
    />
  ),
}));

const iconBoxInstance = (id: string, title: string): ComponentInstance => ({
  id,
  type: "icon-box",
  name: "Icon Box",
  x: 0,
  y: 0,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    title,
    containerHighlighted: false,
  },
});

describe("App", { timeout: 15_000 }, () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
  });

  it("copies the composed canvas as 2x PNG from the single export button", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Copy PNG" }));

    expect(copyDocumentPng).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Copy 2x Retina PNG" })).not.toBeInTheDocument();
  });

  it("switches sidebar panels from the icon rail without unmounting the canvas", () => {
    render(<App />);

    expect(screen.getByTestId("builder-canvas")).toBeInTheDocument();
    const gridButton = screen.getByTestId("rail-tab-grid");
    const componentsButton = screen.getByTestId("rail-tab-components");

    expect(gridButton).toHaveClass("sidebar-rail-button-active");
    expect(componentsButton).not.toHaveClass("sidebar-rail-button-active");
    expect(screen.queryByRole("tab", { name: "Grid" })).not.toBeInTheDocument();

    fireEvent.click(componentsButton);

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(componentsButton).toHaveClass("sidebar-rail-button-active");
    expect(gridButton).not.toHaveClass("sidebar-rail-button-active");
    expect(screen.queryByText("Current instances")).not.toBeInTheDocument();
    expect(screen.getByTestId("builder-canvas")).toBeInTheDocument();
  });

  it("shows a pointer-following ghost while placing a component before the canvas preview starts", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("rail-tab-components"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Icon Box" }), { clientX: 160, clientY: 220 });

    const ghost = screen.getByTestId("component-drag-ghost");
    expect(ghost).toBeInTheDocument();
    expect(ghost).toHaveStyle({ left: "160px", top: "220px" });
  });

  it("finalizes icon-box placement when releasing the pointer over the canvas", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("rail-tab-components"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Icon Box" }), { clientX: 160, clientY: 220 });

    const canvas = screen.getByTestId("builder-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 560,
      right: 800,
      bottom: 560,
      x: 0,
      y: 0,
      toJSON: () => "",
    } as DOMRect);

    const beforeCount = useAppStore.getState().instances.length;

    fireEvent.pointerUp(window, { clientX: 400, clientY: 280 });

    expect(useAppStore.getState().instances.length).toBe(beforeCount + 1);
    expect(useAppStore.getState().selectedInstanceId).toMatch(/^icon-box-/);
    expect(useAppStore.getState().dragState).toBeNull();
    expect(screen.getByText("Layers")).toBeInTheDocument();
  });

  it("starts and cancels connector endpoint picking from the component sidebar", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
        overlayGrid: true,
      },
    };
    useAppStore.setState({ instances: [connector], selectedInstanceId: connector.id });

    render(<App />);
    fireEvent.click(screen.getByTestId("rail-tab-components"));
    fireEvent.click(screen.getByTestId("connector-pick-source-cell"));

    expect(useAppStore.getState().connectorEndpointPick).toEqual({
      connectorId: connector.id,
      endpoint: "source",
      hoverCell: null,
    });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(useAppStore.getState().connectorEndpointPick).toBeNull();
  });

  it("deletes the selected instance when pressing Delete or Backspace outside form fields", () => {
    const inst = iconBoxInstance("icon-box-del-1", "T");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    render(<App />);

    fireEvent.keyDown(document, { key: "Delete", code: "Delete" });
    expect(useAppStore.getState().instances).toHaveLength(0);
    expect(useAppStore.getState().selectedInstanceId).toBeNull();

    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    fireEvent.keyDown(document, { key: "Backspace", code: "Backspace" });
    expect(useAppStore.getState().instances).toHaveLength(0);
    expect(useAppStore.getState().selectedInstanceId).toBeNull();
  });

  it("does not delete the selected instance when Backspace originates from a text field", () => {
    const inst = iconBoxInstance("icon-box-del-2", "Hi");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    render(<App />);
    const title = screen.getByLabelText("Title");
    fireEvent.keyDown(title, { key: "Backspace", bubbles: true });
    expect(useAppStore.getState().instances).toHaveLength(1);
  });

  it("duplicates the selected instance with Ctrl+D and Cmd+D outside form fields", () => {
    const inst = iconBoxInstance("icon-box-7", "Duplicate me");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id, nextInstanceIndex: 8 });
    render(<App />);

    fireEvent.keyDown(document, { key: "d", code: "KeyD", ctrlKey: true });

    expect(useAppStore.getState().instances.map((item) => item.id)).toEqual(["icon-box-8", "icon-box-7"]);
    expect(useAppStore.getState().selectedInstanceId).toBe("icon-box-8");
    expect(useAppStore.getState().instances[0].props).toEqual(inst.props);

    fireEvent.keyDown(document, { key: "d", code: "KeyD", metaKey: true });

    expect(useAppStore.getState().instances.map((item) => item.id)).toEqual(["icon-box-9", "icon-box-8", "icon-box-7"]);
    expect(useAppStore.getState().selectedInstanceId).toBe("icon-box-9");
  });

  it("does not duplicate the selected instance when Ctrl+D originates from a text field", () => {
    const inst = iconBoxInstance("icon-box-10", "Keep one");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id, nextInstanceIndex: 11 });
    render(<App />);

    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "d", code: "KeyD", ctrlKey: true, bubbles: true });

    expect(useAppStore.getState().instances).toHaveLength(1);
    expect(useAppStore.getState().selectedInstanceId).toBe("icon-box-10");
  });

  it("does not apply delete, duplicate, or undo shortcuts while a canvas drag is active", () => {
    const inst = iconBoxInstance("icon-box-guard-1", "G");
    resetAppStoreDocumentToDefault();
    useAppStore.setState({
      instances: [inst],
      selectedInstanceId: inst.id,
      nextInstanceIndex: 5,
    });
    useAppStore.getState().updateGridConfig({ strokeColor: "#ff0000" });
    useAppStore.setState({
      dragState: { mode: "create", type: "icon-box", preview: null, ghostClient: { x: 1, y: 2 } },
    });

    render(<App />);

    fireEvent.keyDown(document, { key: "Delete", code: "Delete" });
    expect(useAppStore.getState().instances).toHaveLength(1);

    fireEvent.keyDown(document, { key: "d", code: "KeyD", ctrlKey: true });
    expect(useAppStore.getState().instances).toHaveLength(1);

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", ctrlKey: true });
    expect(useAppStore.getState().gridConfig.strokeColor).toBe("#ff0000");
  });

  it("does not delete the selected instance when Delete targets a contenteditable element", () => {
    const inst = iconBoxInstance("icon-box-ce-1", "CE");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    render(<App />);

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);
    try {
      fireEvent.keyDown(editable, { key: "Delete", code: "Delete", bubbles: true });
      expect(useAppStore.getState().instances).toHaveLength(1);
    } finally {
      document.body.removeChild(editable);
    }
  });

  it("undoes and redoes document changes with Ctrl/Cmd+Z shortcuts", () => {
    const inst = iconBoxInstance("icon-box-history-1", "History");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id, nextInstanceIndex: 2 });
    render(<App />);

    fireEvent.keyDown(document, { key: "Delete", code: "Delete" });
    expect(useAppStore.getState().instances).toHaveLength(0);

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", ctrlKey: true });
    expect(useAppStore.getState().instances).toEqual([inst]);
    expect(useAppStore.getState().selectedInstanceId).toBe(inst.id);

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", ctrlKey: true, shiftKey: true });
    expect(useAppStore.getState().instances).toHaveLength(0);

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", metaKey: true });
    expect(useAppStore.getState().instances).toEqual([inst]);

    fireEvent.keyDown(document, { key: "z", code: "KeyZ", metaKey: true, shiftKey: true });
    expect(useAppStore.getState().instances).toHaveLength(0);
  });
});
