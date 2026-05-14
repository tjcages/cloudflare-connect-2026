import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import type { ComponentInstance } from "../grid/types";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as hitTest from "./hitTest";
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
  beforeEach(() => {
    pixiProps.length = 0;
    resetAppStoreDocumentToDefault();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sizes the Pixi canvas with the render stroke buffer", () => {
    render(<GridCanvas />);

    const canvas = screen.getByRole("img", { name: "Component builder canvas" });

    expect(canvas).toHaveAttribute("data-layout-width", "801");
    expect(canvas).toHaveAttribute("data-layout-height", "561");
    expect(pixiProps.at(-1)).toMatchObject({ layoutWidth: 801, layoutHeight: 561 });
  });

  it("keeps the connector selected after placing a static endpoint (click does not clear selection)", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
      },
    };
    useAppStore.setState({ instances: [connector], selectedInstanceId: connector.id });
    useAppStore.getState().startConnectorEndpointPick(connector.id, "source");

    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 560,
      top: 0,
      left: 0,
      right: 800,
      bottom: 560,
      toJSON: () => "",
    } as DOMRect);

    render(<GridCanvas />);
    const canvas = screen.getByRole("img", { name: "Component builder canvas" });

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 400, pointerId: 1 });
    fireEvent.click(canvas, { clientX: 10, clientY: 400 });

    expect(useAppStore.getState().selectedInstanceId).toBe(connector.id);
    expect(useAppStore.getState().connectorEndpointPick).toBeNull();
  });

  it("does not clear selection when click hit-test disagrees with pointerdown (avoids config flash)", () => {
    const connector: ComponentInstance = {
      id: "connector-line-1",
      type: "connector-line",
      name: "Connector Line 1",
      x: 40,
      y: 40,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 40 },
        target: { kind: "cell", x: 200, y: 40 },
      },
    };
    useAppStore.setState({ instances: [connector], selectedInstanceId: null });

    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 560,
      top: 0,
      left: 0,
      right: 800,
      bottom: 560,
      toJSON: () => "",
    } as DOMRect);

    const hitSpy = vi
      .spyOn(hitTest, "hitTestComponentInstances")
      .mockReturnValueOnce(connector)
      .mockReturnValueOnce(undefined);

    render(<GridCanvas />);
    const canvas = screen.getByRole("img", { name: "Component builder canvas" });

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.click(canvas, { clientX: 100, clientY: 10 });

    expect(useAppStore.getState().selectedInstanceId).toBe(connector.id);
    // `click` is skipped after `pointerdown`, so hit testing is not re-run for this gesture.
    expect(hitSpy).toHaveBeenCalledTimes(1);

    hitSpy.mockRestore();
  });
});
