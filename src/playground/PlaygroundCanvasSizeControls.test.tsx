/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundCanvasSizeControls } from "./PlaygroundCanvasSizeControls";

describe("PlaygroundCanvasSizeControls", () => {
  it("applies 1x and 2x presets on repeated clicks", () => {
    const applyDisplayScale = vi.fn();

    render(
      <PlaygroundCanvasSizeControls
        sourceWidth={1280}
        sourceHeight={720}
        applyDisplayScale={applyDisplayScale}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "2x" }));
    fireEvent.click(screen.getByRole("button", { name: "1x" }));
    fireEvent.click(screen.getByRole("button", { name: "2x" }));

    expect(applyDisplayScale).toHaveBeenCalledTimes(3);
    expect(applyDisplayScale).toHaveBeenNthCalledWith(1, 2);
    expect(applyDisplayScale).toHaveBeenNthCalledWith(2, 1);
    expect(applyDisplayScale).toHaveBeenNthCalledWith(3, 2);
  });

  it("does not commit an empty custom multiplier when a preset button is clicked", () => {
    const applyDisplayScale = vi.fn();

    render(
      <PlaygroundCanvasSizeControls
        sourceWidth={1280}
        sourceHeight={720}
        applyDisplayScale={applyDisplayScale}
      />,
    );

    const input = screen.getByLabelText("Custom canvas scale multiplier");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "1x" }));

    expect(applyDisplayScale).toHaveBeenCalledTimes(1);
    expect(applyDisplayScale).toHaveBeenCalledWith(1);
  });

  it("commits a custom multiplier on blur", () => {
    const applyDisplayScale = vi.fn();

    render(
      <PlaygroundCanvasSizeControls
        sourceWidth={1280}
        sourceHeight={720}
        applyDisplayScale={applyDisplayScale}
      />,
    );

    const input = screen.getByLabelText("Custom canvas scale multiplier");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);

    expect(applyDisplayScale).toHaveBeenCalledTimes(1);
    expect(applyDisplayScale).toHaveBeenCalledWith(3);
  });
});
