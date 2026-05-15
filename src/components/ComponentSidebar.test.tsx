import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentSidebar } from "./ComponentSidebar";
import type { ComponentInstance } from "../grid/types";
import { DEFAULT_ICON_ID } from "../lib/iconRegistry";

const instance: ComponentInstance = {
  id: "icon-box-1",
  type: "icon-box",
  name: "Icon Box 1",
  x: 40,
  y: 80,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    title: "Workers",
    containerHighlighted: false,
  },
};

const connectorInstance: ComponentInstance = {
  id: "connector-line-2",
  type: "connector-line",
  name: "Connector Line 2",
  x: 40,
  y: 40,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "cell", x: 40, y: 40 },
    target: { kind: "layer", instanceId: "icon-box-1" },
    overlayGrid: true,
    animated: true,
  },
};

const plusMarkerInstance: ComponentInstance = {
  id: "plus-marker-3",
  type: "plus-marker",
  name: "Plus Marker 3",
  x: 120,
  y: 40,
  props: { theme: "orange" },
};

describe("ComponentSidebar", () => {
  it("lists layers and draggable components without legacy copy", () => {
    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(screen.queryByText("Current instances")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Icon Box" })).toBeInTheDocument();
    expect(screen.getByTestId("layer-item-icon-box-1")).toBeInTheDocument();
    expect(screen.queryByText("Drag to canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.queryByText("x: 40, y: 80")).not.toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connector Line" })).toBeInTheDocument();
    expect(screen.getByTestId("layer-config-empty")).toBeInTheDocument();
  });

  it("keeps layer title and dynamic subtitle stacked in the same text block", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = container.querySelector("[data-testid='layer-item-icon-box-1']");
    expect(layerItem).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-list-item-preview")).toBeInTheDocument();

    const textBlock = layerItem?.querySelector(".component-list-item-text");
    expect(textBlock).toBeInTheDocument();
    expect(within(textBlock as HTMLElement).getByText("Icon Box")).toBeInTheDocument();
    expect(within(textBlock as HTMLElement).getByText("Workers")).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-position")).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-list-item-actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Icon Box, Workers" })).not.toBeInTheDocument();
    expect(screen.getByTestId("layer-item-icon-box-1")).toBeInTheDocument();
  });

  it("omits layer subtitle when title is blank", () => {
    const noTitle: ComponentInstance = { ...instance, props: { ...instance.props, title: "" } };
    const { container } = render(
      <ComponentSidebar
        instances={[noTitle]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = container.querySelector("[data-testid='layer-item-icon-box-1']");
    expect(layerItem?.querySelector(".component-position")).not.toBeInTheDocument();
    expect(screen.getByTestId("layer-item-icon-box-1")).toBeInTheDocument();
  });

  it("selects a layer from the row pointer tap without row action controls", () => {
    const onSelectInstance = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={onSelectInstance}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const surface = container.querySelector(".layers-reorder-item-surface");
    expect(surface).toBeInTheDocument();
    fireEvent.click(surface as HTMLElement);

    expect(screen.queryByRole("button", { name: "Delete Icon Box, Workers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Icon Box/i })).not.toBeInTheDocument();

    expect(onSelectInstance).toHaveBeenCalledWith("icon-box-1");
  });

  it("starts component drag from available component cards", () => {
    const onStartComponentDrag = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    const componentButton = screen.getByRole("button", { name: "Icon Box" });

    fireEvent.pointerDown(componentButton, { clientX: 12, clientY: 24 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("icon-box", { clientX: 12, clientY: 24 });
  });

  it("starts component drag from the connector-line component row", () => {
    const onStartComponentDrag = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    const connectorButton = screen.getByRole("button", { name: "Connector Line" });
    const connectorIcon = connectorButton.querySelector("svg.component-icon");
    expect(connectorIcon).toHaveStyle({ color: "#B3B3B3" });

    fireEvent.pointerDown(connectorButton, { clientX: 20, clientY: 30 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("connector-line", { clientX: 20, clientY: 30 });
  });

  it("starts component drag from the plus-marker component row", () => {
    const onStartComponentDrag = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Plus Marker" }), { clientX: 9, clientY: 18 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("plus-marker", { clientX: 9, clientY: 18 });
  });

  it("configures plus-marker theme only", () => {
    const onUpdateInstanceProps = vi.fn();

    render(
      <ComponentSidebar
        instances={[plusMarkerInstance]}
        selectedInstance={plusMarkerInstance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("icon-picker")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("palette-theme-swatch-purple"));
    expect(onUpdateInstanceProps).toHaveBeenCalledWith("plus-marker-3", { theme: "purple" });
  });

  it("configures connector-line preference and endpoints", () => {
    const onUpdateInstanceProps = vi.fn();
    const onStartEndpointPick = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[connectorInstance, instance]}
        selectedInstance={connectorInstance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
        onStartEndpointPick={onStartEndpointPick}
      />,
    );

    expect(screen.getByTestId("component-config-header")).toHaveTextContent("Connector Line");
    fireEvent.change(screen.getByLabelText("Preferred connection"), { target: { value: "vertical" } });

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("connector-line-2", {
      preferredConnection: "vertical",
      source: { kind: "cell", x: 40, y: 40 },
      target: { kind: "layer", instanceId: "icon-box-1" },
      overlayGrid: true,
      animated: true,
    });

    expect(container.querySelector(".connector-endpoint-meta")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Source endpoint" })).not.toBeInTheDocument();

    const sourceEndpointButton = screen.getByTestId("connector-endpoint-trigger-source");
    expect(within(sourceEndpointButton).getByText("Static cell")).toBeInTheDocument();
    expect(within(sourceEndpointButton).getByText("x: 40, y: 40")).toBeInTheDocument();

    fireEvent.click(sourceEndpointButton);

    const layerOption = screen.getByTestId("connector-endpoint-option-layer-icon-box-1");
    expect(layerOption).toHaveClass("component-list-item");
    expect(layerOption.querySelector("svg.component-icon")).toBeInTheDocument();
    expect(within(layerOption).getByText("Workers")).toBeInTheDocument();

    fireEvent.click(layerOption);

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("connector-line-2", {
      preferredConnection: "horizontal",
      source: { kind: "layer", instanceId: "icon-box-1" },
      target: { kind: "layer", instanceId: "icon-box-1" },
      overlayGrid: true,
      animated: true,
    });

    fireEvent.click(screen.getByTestId("connector-pick-source-cell"));

    expect(onStartEndpointPick).toHaveBeenCalledWith("connector-line-2", "source");
  });

  it("toggles connector overlay grid", () => {
    const onUpdateInstanceProps = vi.fn();
    render(
      <ComponentSidebar
        instances={[connectorInstance, instance]}
        selectedInstance={connectorInstance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("toggle-connector-overlay-grid-connector-line-2"));
    expect(onUpdateInstanceProps).toHaveBeenCalledWith("connector-line-2", {
      ...connectorInstance.props,
      overlayGrid: false,
    });
  });

  it("toggles connector animation", () => {
    const onUpdateInstanceProps = vi.fn();
    render(
      <ComponentSidebar
        instances={[connectorInstance, instance]}
        selectedInstance={connectorInstance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("toggle-connector-animated-connector-line-2"));
    expect(onUpdateInstanceProps).toHaveBeenCalledWith("connector-line-2", {
      ...connectorInstance.props,
      animated: false,
    });
  });

  it("omits match corners toggle when accent theme is neutral", () => {
    const neutralThemeInstance: ComponentInstance = { ...instance, props: { ...instance.props, theme: "neutral" } };

    render(
      <ComponentSidebar
        instances={[neutralThemeInstance]}
        selectedInstance={neutralThemeInstance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(`toggle-match-corners-${neutralThemeInstance.id}`)).not.toBeInTheDocument();
  });

  it("marks the selected layer row when the selection changes", () => {
    const second: ComponentInstance = { ...instance, id: "icon-box-2", name: "Icon Box 2" };
    const { rerender } = render(
      <ComponentSidebar
        instances={[instance, second]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    rerender(
      <ComponentSidebar
        instances={[instance, second]}
        selectedInstance={second}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const selectedSurface = document
      .querySelector("[data-testid='layer-item-icon-box-2']")
      ?.closest(".layers-reorder-item-surface");
    expect(selectedSurface).toHaveClass("layers-reorder-item-surface-selected");
    expect(selectedSurface).toHaveAttribute("data-selected", "true");
  });

  it("shows selected component config header like a layer row and updates theme, title, and match corners toggle", () => {
    const onUpdateInstanceProps = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const header = screen.getByTestId("component-config-header");
    expect(header).toHaveTextContent("Icon Box");
    expect(header.querySelector(".component-list-item-actions")).not.toBeInTheDocument();
    expect(header.querySelector(".component-position")).not.toBeInTheDocument();

    expect(container.querySelector(".component-config-top-bar")).not.toBeInTheDocument();
    expect(
      within(header.querySelector(".component-list-item-text") as HTMLElement).getByText("Icon Box"),
    ).toBeInTheDocument();
    expect(screen.getByText("Layers")).toBeInTheDocument();
    const iconPicker = screen.getByTestId("icon-picker");
    const iconOption = within(iconPicker).getByTestId(`icon-picker-${DEFAULT_ICON_ID}`);

    expect(iconOption).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("combobox", { name: "Icon" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Icon color")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Workers");
    const themeGroup = screen.getByTestId("palette-theme-picker");
    expect(within(themeGroup).getByTestId("palette-theme-swatch-purple")).toHaveAttribute("data-selected", "true");
    const matchCornersToggle = screen.getByTestId(`toggle-match-corners-${instance.id}`);
    expect(matchCornersToggle).not.toHaveClass("field-toggle-switch-on");
    const containerHighlightedToggle = screen.getByTestId(`toggle-container-highlighted-${instance.id}`);
    expect(containerHighlightedToggle).not.toHaveClass("field-toggle-switch-on");

    fireEvent.click(containerHighlightedToggle);

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: true,
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "KV" } });

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "KV",
      containerHighlighted: false,
    });

    fireEvent.click(matchCornersToggle);

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      matchCornersWithTheme: true,
      theme: "purple",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: false,
    });
  });

  it("omits deletion controls from the selected instance config header", () => {
    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const header = screen.getByTestId("component-config-header");

    expect(within(header).queryByRole("button", { name: "Delete Icon Box, Workers" })).not.toBeInTheDocument();
  });

  it("updates accent theme from palette swatches", () => {
    const onUpdateInstanceProps = vi.fn();
    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const themeGroup = screen.getByTestId("palette-theme-picker");
    fireEvent.click(within(themeGroup).getByTestId("palette-theme-swatch-orange"));

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      matchCornersWithTheme: false,
      theme: "orange",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: false,
    });
  });
});
