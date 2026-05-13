import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentSidebar } from "./ComponentSidebar";
import { DEFAULT_ICON_ID } from "./iconRegistry";
import type { ComponentInstance } from "../grid/types";

const instance: ComponentInstance = {
  id: "icon-box-1",
  type: "icon-box",
  name: "icon-box 1",
  x: 40,
  y: 80,
  props: {
    cornerColor: "#123456",
    iconColor: "#903EFC",
    iconId: DEFAULT_ICON_ID,
  },
};

describe("ComponentSidebar", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders layers and available components with registry svg icons", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(screen.queryByText("Current instances")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getAllByText("icon-box")).toHaveLength(2);
    expect(screen.queryByText("Drag to canvas")).not.toBeInTheDocument();
    expect(screen.getByText("x: 40, y: 80")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(container.querySelectorAll("canvas.component-preview-canvas")).toHaveLength(0);
    expect(container.querySelectorAll("svg.component-icon")).toHaveLength(2);
  });

  it("uses the shared square preview sizing for layers and component rows", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const previewWrappers = Array.from(container.querySelectorAll(".component-list-item-preview"));
    const previewIcons = Array.from(container.querySelectorAll<SVGSVGElement>("svg.component-icon"));

    expect(previewWrappers).toHaveLength(2);
    expect(previewIcons).toHaveLength(2);
    expect(previewIcons.every((icon) => icon.parentElement?.classList.contains("component-list-item-preview"))).toBe(
      true,
    );
    expect(previewIcons.map((icon) => [icon.getAttribute("width"), icon.getAttribute("height")])).toEqual([
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
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const layerItem = screen.getByTestId("layer-item-icon-box-1");
    const componentItem = screen.getByRole("button", { name: "icon-box" });

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
        onBack={vi.fn()}
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

  it("keeps layer title and position stacked in the same text block", () => {
    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
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
    expect(within(textBlock as HTMLElement).getByText("icon-box")).toBeInTheDocument();
    expect(within(textBlock as HTMLElement).getByText("x: 40, y: 80")).toBeInTheDocument();
    expect(layerItem?.querySelector(".component-list-item-actions")).toContainElement(
      screen.getByRole("button", { name: "Edit icon-box" }),
    );
  });

  it("opens edit and delete actions from icon buttons for instances", () => {
    const onSelectInstance = vi.fn();
    const onDeleteInstance = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={onSelectInstance}
        onBack={vi.fn()}
        onDeleteInstance={onDeleteInstance}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Edit icon-box" });
    const deleteButton = screen.getByRole("button", { name: "Delete icon-box" });

    expect(editButton).toHaveClass("component-row-icon-button");
    expect(deleteButton).toHaveClass("component-row-icon-button");
    expect(editButton.querySelector(".lucide-pencil")).toBeInTheDocument();
    expect(deleteButton.querySelector(".lucide-trash-2")).toBeInTheDocument();
    expect(editButton).not.toHaveTextContent("Edit");
    expect(deleteButton).not.toHaveTextContent("Trash");

    fireEvent.click(editButton);
    fireEvent.click(deleteButton);

    expect(onSelectInstance).toHaveBeenCalledWith("icon-box-1");
    expect(onDeleteInstance).toHaveBeenCalledWith("icon-box-1");
  });

  it("starts component drag from available component cards", () => {
    const onStartComponentDrag = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
        onStartComponentDrag={onStartComponentDrag}
      />,
    );

    const componentButton = screen.getByRole("button", { name: "icon-box" });
    expect(componentButton).toHaveClass("component-list-item");

    fireEvent.pointerDown(componentButton, { clientX: 12, clientY: 24 });

    expect(onStartComponentDrag).toHaveBeenCalledWith("icon-box");
  });

  it("shows selected component config header like a layer row and updates icon and corner config", () => {
    const onUpdateInstanceProps = vi.fn();

    const { container } = render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
        onStartComponentDrag={vi.fn()}
      />,
    );

    const header = screen.getByTestId("component-config-header");
    expect(header).toHaveTextContent("icon-box");
    expect(header).toHaveTextContent("x: 40, y: 80");
    expect(
      within(header.querySelector(".component-list-item-text") as HTMLElement).getByText("icon-box"),
    ).toBeInTheDocument();
    expect(
      within(header.querySelector(".component-list-item-text") as HTMLElement).getByText("x: 40, y: 80"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("canvas.component-preview-canvas")).toHaveLength(0);
    expect(container.querySelectorAll("svg.component-icon")).toHaveLength(2);
    const iconPicker = screen.getByRole("radiogroup", { name: "Icon" });
    const iconOption = within(iconPicker).getByRole("radio", { name: "Section mark" });

    expect(iconOption).toHaveAttribute("aria-checked", "true");
    expect(iconOption.querySelector("svg.component-icon")).toHaveAttribute("width", "16");
    expect(screen.queryByRole("combobox", { name: "Icon" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Icon color")).toHaveValue("#903efc");

    fireEvent.change(screen.getByLabelText("Corner color"), { target: { value: "#abcdef" } });

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      cornerColor: "#abcdef",
      iconColor: "#903EFC",
      iconId: DEFAULT_ICON_ID,
    });

    fireEvent.change(screen.getByLabelText("Icon color"), { target: { value: "#112233" } });

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      cornerColor: "#123456",
      iconColor: "#112233",
      iconId: DEFAULT_ICON_ID,
    });
  });
});
