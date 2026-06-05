/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldHelp } from "./FieldHelp";

describe("FieldHelp", () => {
  it("reveals the field description from the visible label", () => {
    render(<FieldHelp label="Exposure" description="Raises or lowers source light before mapping." />);

    expect(screen.queryByRole("button", { name: "About Exposure" })).not.toBeInTheDocument();

    const trigger = screen.getByText("Exposure");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    const focusedTooltip = screen.getByRole("tooltip");
    expect(focusedTooltip).toHaveTextContent("Raises or lowers source light before mapping.");
    expect(focusedTooltip.parentElement).toBe(document.body);

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
