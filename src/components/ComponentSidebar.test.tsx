import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentSidebar } from "./ComponentSidebar";
import type { ComponentInstance } from "../grid/types";

const instance: ComponentInstance = {
  id: "icon-box-1",
  type: "icon-box",
  name: "icon-box 1",
  x: 40,
  y: 80,
  props: {
    cornerColor: "#123456",
  },
};

describe("ComponentSidebar", () => {
  it("renders current instances and available components", () => {
    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={null}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={vi.fn()}
      />,
    );

    expect(screen.getByText("Current instances")).toBeInTheDocument();
    expect(screen.getByText("icon-box 1")).toBeInTheDocument();
    expect(screen.getByText("x: 40, y: 80")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
  });

  it("opens edit and delete actions for instances", () => {
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit icon-box 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete icon-box 1" }));

    expect(onSelectInstance).toHaveBeenCalledWith("icon-box-1");
    expect(onDeleteInstance).toHaveBeenCalledWith("icon-box-1");
  });

  it("shows selected component config and updates corner color", () => {
    const onUpdateInstanceProps = vi.fn();

    render(
      <ComponentSidebar
        instances={[instance]}
        selectedInstance={instance}
        onSelectInstance={vi.fn()}
        onBack={vi.fn()}
        onDeleteInstance={vi.fn()}
        onUpdateInstanceProps={onUpdateInstanceProps}
      />,
    );

    fireEvent.change(screen.getByLabelText("Corner color"), { target: { value: "#abcdef" } });

    expect(onUpdateInstanceProps).toHaveBeenCalledWith("icon-box-1", {
      cornerColor: "#abcdef",
    });
  });
});
