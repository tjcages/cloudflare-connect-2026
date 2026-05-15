import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GapMaskEditor } from "./GapMaskEditor";

describe("GapMaskEditor", () => {
  it("continues the active drag when the pointer leaves the gap grid", () => {
    const onChange = vi.fn();

    render(
      <GapMaskEditor
        mask={[
          [false, false],
          [false, false],
        ]}
        onChange={onChange}
      />,
    );

    const firstCell = screen.getByTestId("gap-mask-cell-0-0");
    const grid = firstCell.parentElement;

    expect(grid).not.toBeNull();
    vi.spyOn(grid as HTMLElement, "getBoundingClientRect").mockReturnValue({
      bottom: 20,
      height: 20,
      left: 0,
      right: 20,
      top: 0,
      width: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(firstCell, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenCalledWith([
      [true, true],
      [true, true],
    ]);
  });
});
