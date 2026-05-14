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
  GridCanvas: () => <div role="img" aria-label="Component builder canvas" />,
}));

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

    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
    const gridButton = screen.getByRole("button", { name: "Grid" });
    const componentsButton = screen.getByRole("button", { name: "Components" });

    expect(gridButton).toHaveClass("sidebar-rail-button-active");
    expect(gridButton).toHaveAttribute("aria-pressed", "true");
    expect(gridButton.querySelector("[data-testid='grid-divider-icon']")).toBeInTheDocument();
    expect(gridButton.querySelectorAll("path")).toHaveLength(4);
    expect(componentsButton.querySelector("[data-testid='components-rail-icon']")).toBeInTheDocument();
    expect(componentsButton.querySelectorAll("path")).toHaveLength(2);
    expect(componentsButton).toHaveTextContent("");
    expect(screen.queryByRole("tab", { name: "Grid" })).not.toBeInTheDocument();

    fireEvent.click(componentsButton);

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(componentsButton).toHaveAttribute("aria-pressed", "true");
    expect(gridButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Current instances")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
  });

  it("shows a pointer-following ghost while placing a component before the canvas preview starts", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Components" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Icon Box" }), { clientX: 160, clientY: 220 });

    const ghost = screen.getByTestId("component-drag-ghost");
    expect(ghost).toBeInTheDocument();
    expect(ghost.style.left).toBe("160px");
    expect(ghost.style.top).toBe("220px");
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
      },
    };
    useAppStore.setState({ instances: [connector], selectedInstanceId: connector.id });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Components" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick source cell on canvas" }));

    expect(useAppStore.getState().connectorEndpointPick).toEqual({
      connectorId: connector.id,
      endpoint: "source",
      hoverCell: null,
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useAppStore.getState().connectorEndpointPick).toBeNull();
  });

  it("deletes the selected instance when pressing Delete or Backspace outside form fields", () => {
    const inst: ComponentInstance = {
      id: "icon-box-del-1",
      type: "icon-box",
      name: "Icon Box",
      x: 0,
      y: 0,
      props: {
        matchCornersWithTheme: false,
        theme: "purple",
        iconId: DEFAULT_ICON_ID,
        title: "T",
        containerHighlighted: false,
      },
    };
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    render(<App />);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(useAppStore.getState().instances).toHaveLength(0);
    expect(useAppStore.getState().selectedInstanceId).toBeNull();

    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(useAppStore.getState().instances).toHaveLength(0);
    expect(useAppStore.getState().selectedInstanceId).toBeNull();
  });

  it("does not delete the selected instance when Backspace originates from a text field", () => {
    const inst: ComponentInstance = {
      id: "icon-box-del-2",
      type: "icon-box",
      name: "Icon Box",
      x: 0,
      y: 0,
      props: {
        matchCornersWithTheme: false,
        theme: "purple",
        iconId: DEFAULT_ICON_ID,
        title: "Hi",
        containerHighlighted: false,
      },
    };
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id });
    render(<App />);
    const title = screen.getByLabelText("Title");
    fireEvent.keyDown(title, { key: "Backspace", bubbles: true });
    expect(useAppStore.getState().instances).toHaveLength(1);
  });
});
