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

    const canvas = screen.getByTestId("builder-canvas");

    expect(canvas).toHaveAttribute("data-layout-width", "641");
    expect(canvas).toHaveAttribute("data-layout-height", "561");
    expect(pixiProps.at(-1)).toMatchObject({ layoutWidth: 641, layoutHeight: 561 });
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
        overlayGrid: true,
        animated: true,
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
    const canvas = screen.getByTestId("builder-canvas");

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
        overlayGrid: true,
        animated: true,
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
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 10, pointerId: 1 });
    fireEvent.click(canvas, { clientX: 100, clientY: 10 });

    expect(useAppStore.getState().selectedInstanceId).toBe(connector.id);
    // `click` is skipped after `pointerdown`, so hit testing is not re-run for this gesture.
    expect(hitSpy).toHaveBeenCalledTimes(1);

    hitSpy.mockRestore();
  });

  it("pans the viewport when Space+primary-dragging empty canvas space past a small threshold", () => {
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

    useAppStore.setState({ instances: [], selectedInstanceId: null });

    render(<GridCanvas />);
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.keyDown(window, { key: " ", code: "Space" });

    fireEvent.pointerDown(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
      clientY: 100,
    });

    fireEvent.pointerMove(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      buttons: 1,
      clientX: 106,
      clientY: 100,
    });

    fireEvent.pointerMove(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      buttons: 1,
      clientX: 136,
      clientY: 130,
    });

    expect(useAppStore.getState().canvasPan).toEqual({ x: 30, y: 30 });

    fireEvent.pointerUp(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      button: 0,
    });

    expect(useAppStore.getState().canvasPan).toEqual({ x: 30, y: 30 });

    fireEvent.keyUp(window, { key: " ", code: "Space" });
  });

  it("does not pan the viewport when primary-dragging empty canvas without Space", () => {
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

    useAppStore.setState({ instances: [], selectedInstanceId: null, canvasPan: { x: 0, y: 0 } });

    render(<GridCanvas />);
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.pointerDown(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
      clientY: 100,
    });

    fireEvent.pointerMove(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      buttons: 1,
      clientX: 136,
      clientY: 130,
    });

    fireEvent.pointerUp(canvas, {
      pointerId: 9,
      pointerType: "mouse",
      button: 0,
    });

    expect(useAppStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
  });

  it("keeps layer selection while viewport-panning empty canvas; tap empty clears", () => {
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

    const placed: ComponentInstance = {
      id: "icon-box-pan-1",
      type: "icon-box",
      name: "Icon Box",
      x: 40,
      y: 40,
      props: {
        matchCornersWithTheme: false,
        theme: "purple",
        iconId: "section-mark",
        title: "T",
        containerHighlighted: false,
      },
    };
    useAppStore.setState({ instances: [placed], selectedInstanceId: placed.id });

    render(<GridCanvas />);
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.keyDown(window, { key: " ", code: "Space" });

    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "mouse",
      button: 0,
      clientX: 400,
      clientY: 400,
    });

    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "mouse",
      buttons: 1,
      clientX: 406,
      clientY: 400,
    });

    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "mouse",
      buttons: 1,
      clientX: 430,
      clientY: 410,
    });

    fireEvent.pointerUp(canvas, {
      pointerId: 2,
      pointerType: "mouse",
      button: 0,
    });

    expect(useAppStore.getState().selectedInstanceId).toBe(placed.id);

    fireEvent.keyUp(window, { key: " ", code: "Space" });
    fireEvent.pointerDown(canvas, {
      pointerId: 3,
      pointerType: "mouse",
      button: 0,
      clientX: 400,
      clientY: 400,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 3,
      pointerType: "mouse",
      button: 0,
    });

    fireEvent.click(canvas, { clientX: 400, clientY: 400 });

    expect(useAppStore.getState().selectedInstanceId).toBeNull();
  });

  it("zooms the viewport when cmd+wheel over the canvas (pinch uses ctrlKey on some platforms)", () => {
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

    useAppStore.setState({
      instances: [],
      selectedInstanceId: null,
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
    });

    render(<GridCanvas />);
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.wheel(canvas, {
      deltaY: -200,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      metaKey: true,
      clientX: 400,
      clientY: 280,
    });

    expect(useAppStore.getState().canvasZoom).toBeGreaterThan(1);
  });

  it("pans the viewport when wheeling over the canvas without a modifier (trackpad scroll → pan)", () => {
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

    useAppStore.setState({
      instances: [],
      selectedInstanceId: null,
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
    });

    render(<GridCanvas />);
    const canvas = screen.getByTestId("builder-canvas");

    fireEvent.wheel(canvas, {
      deltaX: 10,
      deltaY: 20,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      metaKey: false,
      ctrlKey: false,
      clientX: 100,
      clientY: 100,
    });

    expect(useAppStore.getState().canvasPan).toEqual({ x: -10, y: -20 });
  });
});
