import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ControlValueInput } from "./ControlValueInput";

describe("ControlValueInput", () => {
  it("commits on blur only, not while typing", () => {
    const onChange = vi.fn();
    render(
      <ControlValueInput
        value={0.095}
        inputMin={0.01}
        inputMax={10}
        commitMin={0.01}
        commitMax={0.5}
        onChange={onChange}
        formatDisplay={(v) => v.toFixed(3)}
        ariaLabel="Bg match"
      />,
    );

    const input = screen.getByLabelText("Bg match");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0.12" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0.12);
  });

  it("clamps on blur and commits on Enter", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ControlValueInput
        value={0.095}
        inputMin={0.01}
        inputMax={10}
        commitMin={0.01}
        commitMax={0.5}
        onChange={onChange}
        formatDisplay={(v) => v.toFixed(3)}
        ariaLabel="Bg match"
      />,
    );

    const input = screen.getByLabelText("Bg match");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(0.5);

    rerender(
      <ControlValueInput
        value={0.5}
        inputMin={0.01}
        inputMax={10}
        commitMin={0.01}
        commitMax={0.5}
        onChange={onChange}
        formatDisplay={(v) => v.toFixed(3)}
        ariaLabel="Bg match"
      />,
    );
    expect(input).toHaveValue("0.500");
  });

  it("reverts invalid drafts on Escape without calling onChange", () => {
    const onChange = vi.fn();
    render(<ControlValueInput value={0.095} inputMin={0.01} inputMax={0.5} onChange={onChange} ariaLabel="Bg match" />);

    const input = screen.getByLabelText("Bg match");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("0.095");
  });
});
