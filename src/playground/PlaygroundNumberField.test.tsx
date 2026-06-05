/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundNumberField } from "./PlaygroundNumberField";

describe("PlaygroundNumberField", () => {
  it("fires onLiveChange during range scrub and onChange on pointer up", () => {
    const onChange = vi.fn();
    const onLiveChange = vi.fn();

    render(
      <PlaygroundNumberField
        label="Cell width"
        value={7}
        inputMin={1}
        inputMax={64}
        sliderMin={1}
        sliderMax={24}
        step={1}
        ariaLabel="Cell width in px"
        disabled={false}
        onChange={onChange}
        onLiveChange={onLiveChange}
        description="Cell width help"
      />,
    );

    const slider = screen.getByLabelText("Cell width in px slider");
    fireEvent.pointerDown(slider);
    fireEvent.input(slider, { target: { value: "10" } });
    expect(onLiveChange).toHaveBeenCalledWith(10);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("falls back to onChange when onLiveChange is omitted", () => {
    const onChange = vi.fn();

    render(
      <PlaygroundNumberField
        label="Gap X"
        value={0}
        inputMin={0}
        inputMax={10}
        sliderMin={0}
        sliderMax={10}
        step={0.5}
        ariaLabel="Horizontal gap"
        disabled={false}
        onChange={onChange}
        description="Gap help"
      />,
    );

    const slider = screen.getByLabelText("Horizontal gap slider");
    fireEvent.pointerDown(slider);
    fireEvent.input(slider, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
