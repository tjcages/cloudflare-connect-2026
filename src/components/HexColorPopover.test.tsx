import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HexColorPopover } from "./HexColorPopover";

describe("HexColorPopover", () => {
  it("keeps the popover closed until the trigger is clicked", () => {
    render(<HexColorPopover color="#aabbcc" onChange={() => {}} ariaLabel="Test color" />);

    expect(screen.queryByLabelText("Test color hex value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Test color"));

    expect(screen.getByLabelText("Test color hex value")).toBeInTheDocument();
  });

  it("emits a prefixed hex string from the text field", () => {
    const onChange = vi.fn();
    render(<HexColorPopover color="#aabbcc" onChange={onChange} ariaLabel="Test color" />);

    fireEvent.click(screen.getByLabelText("Test color"));
    fireEvent.change(screen.getByLabelText("Test color hex value"), { target: { value: "112233" } });

    expect(onChange).toHaveBeenCalledWith("#112233");
  });

  it("does not open when disabled", () => {
    render(<HexColorPopover color="#aabbcc" onChange={() => {}} ariaLabel="Test color" disabled />);

    fireEvent.click(screen.getByLabelText("Test color"));

    expect(screen.queryByLabelText("Test color hex value")).not.toBeInTheDocument();
  });
});
