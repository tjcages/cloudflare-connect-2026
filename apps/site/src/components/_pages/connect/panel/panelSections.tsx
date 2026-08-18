import {
  ControlSection,
  renderPanelField,
  type AnyRenderableField,
  type PanelField,
  type RenderFieldContext,
} from "@tjcages/panels/dev";
import { useState } from "react";
import { loadControlDrawerOpen, saveControlDrawerOpen } from "./drawerState";

/** Values shape shared by every target — reconciled at the panel boundary. */
export type PanelValues = Record<string, unknown>;

/**
 * Site-local escape hatch for controls the package doesn't ship (the rain's
 * GLSL editor). Rendered in place of `renderPanelField`, with the same ctx.
 */
export type PanelCustomField = {
  type: "site-custom";
  key: string;
  render: (ctx: RenderFieldContext) => React.ReactNode;
};

export type PanelFieldDef = PanelField<PanelValues> | PanelCustomField;

/**
 * One collapsible drawer of the shader panel. `id` keys the persisted
 * open/closed state (the same ids — and the same localStorage blob — the
 * previous leva panel used, so saved drawer states carry over). Nested
 * `children` reuse those ids (Twizzler Shape / Gradients / Stroke / Motion).
 */
export type PanelSectionDef = {
  id: string;
  title: string;
  defaultOpen?: boolean;
  /** Persist open/closed across reloads. Default true; Config stays ephemeral. */
  persistOpen?: boolean;
  fields: PanelFieldDef[];
  children?: PanelSectionDef[];
};

function DrawerSection({
  section,
  children,
}: {
  section: PanelSectionDef;
  children: React.ReactNode;
}) {
  const { id, title, defaultOpen = false, persistOpen = true } = section;
  const [open, setOpen] = useState(() =>
    persistOpen ? loadControlDrawerOpen(id, defaultOpen) : defaultOpen
  );
  return (
    <ControlSection
      onOpenChange={(next) => {
        setOpen(next);
        if (persistOpen) saveControlDrawerOpen(id, next);
      }}
      open={open}
      title={title}
    >
      {children}
    </ControlSection>
  );
}

/**
 * Render a target's sections through the package field renderer — every
 * control (sliders, selects, library colors, the gradient hotspot editor,
 * the stripe palette table) comes from @tjcages/panels.
 */
export function PanelSections({
  sections,
  values,
  onChange,
}: {
  sections: PanelSectionDef[];
  values: PanelValues;
  onChange: (next: PanelValues) => void;
}) {
  const ctx: RenderFieldContext = {
    values,
    setValues: onChange,
    rootValues: values,
    setRootValues: onChange,
  };
  return (
    <div className="panel-fields">
      {sections.map((section) => (
        <DrawerSection key={section.id} section={section}>
          {renderSectionBody(section, ctx)}
        </DrawerSection>
      ))}
    </div>
  );
}

function renderSectionBody(
  section: PanelSectionDef,
  ctx: RenderFieldContext
): React.ReactNode {
  return (
    <>
      {section.fields.map((field) => {
        if (field.type === "site-custom") {
          return (
            <div className="panel-field" key={field.key}>
              {field.render(ctx)}
            </div>
          );
        }
        const rendered = renderPanelField(field as AnyRenderableField, ctx);
        if (!rendered) return null;
        return (
          <div className="panel-field" key={rendered.reactKey}>
            {rendered.node}
          </div>
        );
      })}
      {section.children?.map((child) => (
        <DrawerSection key={child.id} section={child}>
          {renderSectionBody(child, ctx)}
        </DrawerSection>
      ))}
    </>
  );
}
