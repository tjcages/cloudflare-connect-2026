import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import { Sidebar } from "./Sidebar";

const renderSidebar = (overrides: Partial<ComponentProps<typeof Sidebar>> = {}) => {
  const props = {
    config: DEFAULT_CONFIG,
    cellCount: 0,
    logicalSize: {
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
    },
    renderSize: {
      width: DEFAULT_CONFIG.width + 1,
      height: DEFAULT_CONFIG.height + 1,
    },
    onConfigChange: vi.fn(),
    onSmallRatioChange: vi.fn(),
    onLargeRatioChange: vi.fn(),
    onStrokeColorChange: vi.fn(),
    onGenerate: vi.fn(),
    onGapMaskChange: vi.fn(),
    onCopyPng: vi.fn(),
    copyState: "idle" as const,
    ...overrides,
  };

  render(<Sidebar {...props} />);

  return props;
};

describe("Sidebar stroke color field", () => {
  it("updates the configured stroke color", () => {
    const { onStrokeColorChange } = renderSidebar();
    const strokeColorInput = screen.getByLabelText("Stroke color");

    fireEvent.change(strokeColorInput, { target: { value: "#123456" } });

    expect(onStrokeColorChange).toHaveBeenCalledWith("#123456");
  });

  it("renders a filled 2px stroke color preview", () => {
    renderSidebar({
      config: {
        ...DEFAULT_CONFIG,
        strokeColor: "#123456",
      },
    });

    const preview = screen.getByTestId("stroke-color-preview");

    expect(preview).toHaveStyle({
      backgroundColor: "#123456",
      height: "2px",
    });
  });

  it("hides stroke reset when color matches default", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: /reset stroke color to default/i })).not.toBeInTheDocument();
  });

  it("shows stroke reset when color differs from default", () => {
    renderSidebar({
      config: {
        ...DEFAULT_CONFIG,
        strokeColor: "#123456",
      },
    });
    expect(screen.getByRole("button", { name: /reset stroke color to default/i })).toBeEnabled();
  });

  it("resets stroke color to default via undo control", () => {
    const { onStrokeColorChange } = renderSidebar({
      config: {
        ...DEFAULT_CONFIG,
        strokeColor: "#123456",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /reset stroke color to default/i }));

    expect(onStrokeColorChange).toHaveBeenCalledWith(DEFAULT_CONFIG.strokeColor);
  });

  it("treats stroke default case-insensitively when hiding reset", () => {
    renderSidebar({
      config: {
        ...DEFAULT_CONFIG,
        strokeColor: "#f3f3f3",
      },
    });
    expect(screen.queryByRole("button", { name: /reset stroke color to default/i })).not.toBeInTheDocument();
  });
});
