import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { copyDocumentPng } from "../canvas/pngExport";
import { App } from "./App";

vi.mock("../canvas/pngExport", () => ({
  copyDocumentPng: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../canvas", () => ({
  GridCanvas: () => <div role="img" aria-label="Component builder canvas" />,
}));

describe("App", () => {
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
    expect(componentsButton.querySelector(".lucide-layers-2")).toBeInTheDocument();
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
});
