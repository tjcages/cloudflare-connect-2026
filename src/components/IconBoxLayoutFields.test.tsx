import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IconBoxLayoutFields } from "./IconBoxLayoutFields";

describe("IconBoxLayoutFields", () => {
  it("keeps draft editable while focused and commits clamped length on blur", () => {
    const onLengthChange = vi.fn();
    render(
      <IconBoxLayoutFields
        instanceId="icon-box-1"
        length={3}
        direction="horizontal"
        onLengthChange={onLengthChange}
        onDirectionChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Length");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(onLengthChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "4" } });
    expect(onLengthChange).toHaveBeenCalledWith(4);
    expect(input).toHaveValue("4");

    fireEvent.blur(input);
    expect(onLengthChange).toHaveBeenCalledTimes(1);
  });

  it("updates length live when the draft is a valid integer", () => {
    const onLengthChange = vi.fn();
    render(
      <IconBoxLayoutFields
        instanceId="icon-box-4"
        length={2}
        direction="horizontal"
        onLengthChange={onLengthChange}
        onDirectionChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Length");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "4" } });
    expect(onLengthChange).toHaveBeenCalledWith(4);
  });

  it("clamps invalid draft values on blur without updating while focused", () => {
    const onLengthChange = vi.fn();
    render(
      <IconBoxLayoutFields
        instanceId="icon-box-2"
        length={2}
        direction="horizontal"
        onLengthChange={onLengthChange}
        onDirectionChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Length");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-1" } });
    expect(onLengthChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onLengthChange).toHaveBeenCalledWith(1);
  });

  it("disables direction when length is 1", () => {
    render(
      <IconBoxLayoutFields
        instanceId="icon-box-3"
        length={1}
        direction="horizontal"
        onLengthChange={vi.fn()}
        onDirectionChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Direction")).toBeDisabled();
  });
});
