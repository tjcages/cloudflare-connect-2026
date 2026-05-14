import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentSidebar } from "./ComponentSidebar";
import type { ComponentInstance } from "../grid/types";
import { DEFAULT_ICON_ID, ICON_OPTIONS } from "../lib/iconRegistry";

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
  },
};

describe("ComponentSidebar", () => {
  it("renders layers and available components with registry svg icons", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(screen.queryByText("Current instances")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Icon Box")).toHaveLength(2);
    expect(screen.queryByText("Drag to canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.queryByText("x: 40, y: 80")).not.toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(container.querySelectorAll("canvas.component-preview-canvas")).toHaveLength(0);
    expect(container.querySelectorAll("svg.component-icon")).toHaveLength(3);
  });

  it("uses the shared square preview sizing for layers and component rows", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const previewWrappers = Array.from(container.querySelectorAll(".component-list-item-preview"));
    const previewIcons = Array.from(container.querySelectorAll<SVGSVGElement>("svg.component-icon"));

    expect(previewWrappers).toHaveLength(3);
    expect(previewIcons).toHaveLength(3);
    expect(previewIcons.every((icon) => icon.parentElement?.classList.contains("component-list-item-preview"))).toBe(
      true,
    );
    expect(previewIcons.map((icon) => [icon.getAttribute("width"), icon.getAttribute("height")])).toEqual([
      ["16", "16"],
      ["16", "16"],
      ["16", "16"],
    ]);
  });

  it("uses the same shared item shell for layer and component rows", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = screen.getByTestId("layer-item-icon-box-1");
    const componentItem = screen.getByRole("button", { name: "Icon Box" });

    expect(layerItem).toHaveClass("component-list-item");
    expect(componentItem).toHaveClass("component-list-item");
    expect(componentItem).not.toHaveClass("component-card");
    expect(container.querySelector(".component-row")).not.toBeInTheDocument();
    expect(layerItem.querySelector(".component-list-item-preview")).toBeInTheDocument();
    expect(componentItem.querySelector(".component-list-item-preview")).toBeInTheDocument();
  });

  it("keeps layers and available components in fixed-height scroll sections", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const sections = Array.from(container.querySelectorAll(":scope .component-sidebar > .component-section"));

    expect(sections).toHaveLength(2);
    expect(sections.every((section) => section.querySelector(".component-scroll-region"))).toBe(true);
    expect(sections.map((section) => section.textContent)).toEqual([
      expect.stringContaining("Components"),
      expect.stringContaining("Layers"),
    ]);
  });

  it("keeps layer title and dynamic subtitle stacked in the same text block", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = container.querySelector("[data-testid='layer-item-icon-box-1']");
    expect(layerItem).toBeInTheDocument();
    expect(layerItem?.querySelector("svg.component-icon")).toBeInTheDocument();

    const textBlock = layerItem?.querySelector(".component-list-item-text");
    expect(textBlock).toBeInTheDocument();
    expect(within(textBlock as HTMLElement).getByText("Icon Box")).toBeInTheDocument();
    expect(within(textBlock as HTMLElement).getByText("Workers")).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-position")).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-list-item-actions")).toContainElement(
      screen.getByRole("button", { name: "Delete Icon Box, Workers" }),
    );
    expect(screen.getByLabelText("Select Icon Box, Workers")).toBeInTheDocument();
  });

  it("omits layer subtitle when title is blank", () => {
    const noTitle: ComponentInstance = { ...instance, props: { ...instance.props, title: "" } };
    const { container } = render(
      <ComponentSidebar
        instances={[noTitle]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = container.querySelector("[data-testid='layer-item-icon-box-1']");
    expect(layerItem?.querySelector(".component-position")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select Icon Box")).toBeInTheDocument();
  });

  it("selects a layer from the row pointer tap and deletes from the trash control", () => {
    const onSelectInstance = vi.fn();
    const onDeleteInstance = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={onSelectInstance}
        onDeleteInstance={onDeleteInstance}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const surface = container.querySelector(".layers-reorder-item-surface");
    expect(surface).toBeInTheDocument();
    fireEvent.click(surface as HTMLElement);

    const deleteButton = screen.getByRole("button", { name: "Delete Icon Box, Workers" });

    expect(deleteButton).toHaveClass("component-row-icon-button");
    expect(deleteButton.querySelector(".lucide-trash-2")).toBeInTheDocument();
    expect(deleteButton).not.toHaveTextContent("Trash");
    expect(screen.queryByRole("button", { name: /Edit Icon Box/i })).not.toBeInTheDocument();

    expect(onSelectInstance).toHaveBeenCalledWith("icon-box-1");

    fireEvent.click(deleteButton);

    expect(onDeleteInstance).toHaveBeenCalledWith("icon-box-1");
  });

  it("starts component drag from available component cards", () => {
    const onStartComponentDrag = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    const componentButton = screen.getByRole("button", { name: "Icon Box" });
    expect(componentButton).toHaveClass("component-list-item");

    fireEvent.pointerDown(componentButton, { clientX: 12, clientY: 24 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("icon-box", { clientX: 12, clientY: 24 });
  });

  it("starts component drag from the connector-line component row", () => {
    const onStartComponentDrag = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    const connectorButton = screen.getByRole("button", { name: "Connector Line" });
    const connectorIcon = connectorButton.querySelector("svg.component-icon");
    expect(connectorIcon).toHaveStyle({ color: "#B3B3B3" });
    expect(container.querySelector("svg.component-icon path[d='M5 9h6v6h8']")).toBeInTheDocument();

    fireEvent.pointerDown(connectorButton, { clientX: 20, clientY: 30 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("connector-line", { clientX: 20, clientY: 30 });
  });

  it("configures connector-line preference and endpoints", () => {
    const onUpdateInstanceProps = vi.fn();
    const onStartEndpointPick = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[connectorInstance, instance]}
        selectedInstance={connectorInstance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
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
    });

    expect(container.querySelector(".connector-endpoint-meta")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Source endpoint" })).not.toBeInTheDocument();

    const sourceEndpointButton = screen.getByRole("button", { name: "Source endpoint" });
    expect(within(sourceEndpointButton).getByText("Static cell")).toBeInTheDocument();
    expect(within(sourceEndpointButton).getByText("x: 40, y: 40")).toBeInTheDocument();

    fireEvent.click(sourceEndpointButton);

    const layerOption = screen.getByRole("option", { name: /Icon Box\s*Workers/ });
    expect(layerOption).toHaveClass("component-list-item");
    expect(layerOption.querySelector("svg.component-icon")).toBeInTheDocument();
    expect(within(layerOption).getByText("Workers")).toBeInTheDocument();

    fireEvent.click(layerOption);

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("connector-line-2", {
      preferredConnection: "horizontal",
      source: { kind: "layer", instanceId: "icon-box-1" },
      target: { kind: "layer", instanceId: "icon-box-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Pick source cell on canvas" }));

    expect(onStartEndpointPick).toHaveBeenCalledWith("connector-line-2", "source");
  });

  it("uses shared icon button styling for static endpoint target buttons", () => {
    render(
      <ComponentSidebar
        instances={[connectorInstance, instance]}
        selectedInstance={connectorInstance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
        onStartEndpointPick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Pick source cell on canvas" })).toHaveClass(
      "component-row-icon-button",
      "connector-endpoint-pick-button",
    );
    expect(screen.getByRole("button", { name: "Pick target cell on canvas" })).toHaveClass(
      "component-row-icon-button",
      "connector-endpoint-pick-button",
    );
  });

  it("omits match corners toggle when accent theme is neutral", () => {
    const neutralThemeInstance: ComponentInstance = { ...instance, props: { ...instance.props, theme: "neutral" } };

    render(
      <ComponentSidebar
        instances={[neutralThemeInstance]}
        selectedInstance={neutralThemeInstance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.queryByRole("switch", { name: /Match corners with theme/i })).not.toBeInTheDocument();
  });

  it("marks the selected layer row and scrolls it into view when the selection changes", () => {
    const prevScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn() as typeof HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    try {
      const second: ComponentInstance = { ...instance, id: "icon-box-2", name: "Icon Box 2" };
      const { rerender } = render(
        <ComponentSidebar
          instances={[instance, second]}
          selectedInstance={null}
          onSelectInstance={vi.fn()}
          onDeleteInstance={vi.fn()}
          onUpdateInstanceProps={vi.fn()}
          onStartComponentDrag={vi.fn()}
        />,
      );

      rerender(
        <ComponentSidebar
          instances={[instance, second]}
          selectedInstance={second}
          onSelectInstance={vi.fn()}
          onDeleteInstance={vi.fn()}
          onUpdateInstanceProps={vi.fn()}
          onStartComponentDrag={vi.fn()}
        />,
      );

      const selectedSurface = document
        .querySelector("[data-testid='layer-item-icon-box-2']")
        ?.closest(".layers-reorder-item-surface");
      expect(selectedSurface).toHaveClass("layers-reorder-item-surface-selected");
      expect(selectedSurface).toHaveAttribute("data-selected", "true");
      expect(scrollIntoViewMock).toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = prevScrollIntoView;
    }
  });

  it("shows selected component config header like a layer row and updates theme, title, and match corners toggle", () => {
    const onUpdateInstanceProps = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const header = screen.getByTestId("component-config-header");
    expect(header).toHaveTextContent("Icon Box");
    expect(window.getComputedStyle(header.querySelector(".component-list-item-actions") as HTMLElement).opacity).toBe(
      "1",
    );
    expect(header.querySelector(".component-position")).not.toBeInTheDocument();

    expect(container.querySelector(".component-config-top-bar")).not.toBeInTheDocument();
    expect(
      within(header.querySelector(".component-list-item-text") as HTMLElement).getByText("Icon Box"),
    ).toBeInTheDocument();
    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(container.querySelectorAll("canvas.component-preview-canvas")).toHaveLength(0);
    expect(container.querySelectorAll("svg.component-icon")).toHaveLength(ICON_OPTIONS.length + 4);
    const iconPicker = screen.getByRole("radiogroup", { name: "Icon" });
    const iconOption = within(iconPicker).getByRole("radio", { name: "Section mark" });

    expect(iconOption).toHaveAttribute("aria-checked", "true");
    expect(iconOption.querySelector("svg.component-icon")).toHaveAttribute("width", "16");
    expect(screen.queryByRole("combobox", { name: "Icon" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Icon color")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Workers");
    const themeGroup = screen.getByRole("radiogroup", { name: "Theme" });
    expect(within(themeGroup).getByRole("radio", { name: "Purple" })).toHaveAttribute("aria-checked", "true");
    const matchCornersToggle = screen.getByRole("switch", { name: /Match corners with theme/i });
    expect(matchCornersToggle).toHaveAttribute("aria-checked", "false");
    const containerHighlightedToggle = screen.getByRole("switch", { name: /Container highlighted/i });
    expect(containerHighlightedToggle).toHaveAttribute("aria-checked", "false");

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

  it("deletes selected instance from config header trash", () => {
    const onDeleteInstance = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={onDeleteInstance}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const header = screen.getByTestId("component-config-header");
    fireEvent.click(within(header).getByRole("button", { name: "Delete Icon Box, Workers" }));

    expect(onDeleteInstance).toHaveBeenCalledWith("icon-box-1");
  });

  it("updates accent theme from palette swatches", () => {
    const onUpdateInstanceProps = vi.fn();
    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const themeGroup = screen.getByRole("radiogroup", { name: "Theme" });
    fireEvent.click(within(themeGroup).getByRole("radio", { name: "Orange" }));

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      matchCornersWithTheme: false,
      theme: "orange",
      iconId: DEFAULT_ICON_ID,
      title: "Workers",
      containerHighlighted: false,
    });
  });
});
