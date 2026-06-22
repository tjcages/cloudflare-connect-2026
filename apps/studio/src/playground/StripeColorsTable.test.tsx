/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StripeColorsTable } from "./StripeColorsTable";
import { cloneDefaultStripes } from "@necatikcl/stripes-shader";

describe("StripeColorsTable", () => {
  it("renders stripe rows with column headers", () => {
    render(
      <StripeColorsTable
        stripes={cloneDefaultStripes()}
        onColorChange={() => {}}
        onThresholdChange={() => {}}
        onWidthChange={() => {}}
        onColorReorder={() => {}}
      />,
    );

    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("Threshold")).toBeInTheDocument();
    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Stripe \d+ color$/)).toHaveLength(6);
    expect(screen.getAllByLabelText(/^Reorder Stripe \d+ color$/)).toHaveLength(6);
  });

  it("calls threshold and width handlers with clamped values", () => {
    const onThresholdChange = vi.fn();
    const onWidthChange = vi.fn();
    const stripes = cloneDefaultStripes();

    render(
      <StripeColorsTable
        stripes={stripes}
        onColorChange={() => {}}
        onThresholdChange={onThresholdChange}
        onWidthChange={onWidthChange}
        onColorReorder={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Stripe 1 threshold"), { target: { value: "1.5" } });
    expect(onThresholdChange).toHaveBeenCalledWith(stripes[0]!.id, 1);

    fireEvent.change(screen.getByLabelText("Stripe 1 width"), { target: { value: "0" } });
    expect(onWidthChange).toHaveBeenCalledWith(stripes[0]!.id, 1);
  });

  it("calls color handler when hex input changes", () => {
    const onColorChange = vi.fn();
    const stripes = cloneDefaultStripes();

    render(
      <StripeColorsTable
        stripes={stripes}
        onColorChange={onColorChange}
        onThresholdChange={() => {}}
        onWidthChange={() => {}}
        onColorReorder={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText("Stripe 1 color"));
    const hexInput = screen.getByLabelText("Stripe 1 color hex value");
    fireEvent.change(hexInput, { target: { value: "#112233" } });
    expect(onColorChange).toHaveBeenCalledWith(stripes[0]!.id, "#112233");
  });
});
