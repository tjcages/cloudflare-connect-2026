import { render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { GridCanvas } from "./index";

const { pixiProps } = vi.hoisted(() => ({
  pixiProps: [] as Array<{ layoutWidth: number; layoutHeight: number }>,
}));

vi.mock("../components/pixi", () => ({
  default: (props: { canvasAttrs?: HTMLAttributes<HTMLCanvasElement>; layoutWidth: number; layoutHeight: number }) => {
    pixiProps.push(props);

    return (
      <canvas {...props.canvasAttrs} data-layout-height={props.layoutHeight} data-layout-width={props.layoutWidth} />
    );
  },
}));

describe("GridCanvas", () => {
  it("sizes the Pixi canvas with the render stroke buffer", () => {
    render(<GridCanvas />);

    const canvas = screen.getByRole("img", { name: "Component builder canvas" });

    expect(canvas).toHaveAttribute("data-layout-width", "801");
    expect(canvas).toHaveAttribute("data-layout-height", "561");
    expect(pixiProps.at(-1)).toMatchObject({ layoutWidth: 801, layoutHeight: 561 });
  });
});
