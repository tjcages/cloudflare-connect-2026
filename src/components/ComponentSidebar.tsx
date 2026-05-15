import { Reorder, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PointerEventHandler, ReactNode } from "react";
import { getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import { useAppStore } from "../store";
import type { ComponentInstance, ComponentProps, ComponentType, IconId } from "../grid/types";
import { ComponentListItem } from "./ComponentListItem";
import { ConnectorEndpointField } from "./ConnectorEndpointControls";
import { ConfigSeparator } from "./ConfigSeparator";
import { FieldToggle } from "./FieldToggle";
import { IconPickerField } from "./IconPickerField";
import { SectionHeading } from "./SectionHeading";
import { COMPONENT_DEFINITION_LIST, createSidebarPreviewRenderers } from "./sidebarPreview";
import { ThemeField } from "./ThemeField";
import { useScrollbarThumbFlash } from "./useScrollbarThumbFlash";

export type ComponentBrowseSidebarProps = {
  instances: ComponentInstance[];
  selectedInstance: ComponentInstance | null;
  onSelectInstance: (id: string) => void;
  onStartComponentDrag: (type: ComponentType, pointer?: { clientX: number; clientY: number }) => void;
  /** When set, neutral theme fills track this hex (same source as grid stroke). */
  gridStrokeColor?: string;
  /** When omitted, layers are not persisted to the store via reorder (defaults to no-op). */
  onReorderInstances?: (orderedIds: string[]) => void;
};

export type ComponentConfigSidebarProps = {
  instances: ComponentInstance[];
  selectedInstance: ComponentInstance | null;
  onUpdateInstanceProps: (id: string, props: ComponentProps) => void;
  onStartEndpointPick?: (id: string, endpoint: "source" | "target") => void;
  /** When set, neutral theme fills track this hex (same source as grid stroke). */
  gridStrokeColor?: string;
};

export type ComponentSidebarProps = ComponentBrowseSidebarProps & {
  onUpdateInstanceProps: (id: string, props: ComponentProps) => void;
  onStartEndpointPick?: (id: string, endpoint: "source" | "target") => void;
};

const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;

const layerDragDistanceThresholdPx = 10;

type LayerReorderRowProps = {
  instance: ComponentInstance;
  instances: ComponentInstance[];
  preview: ReactNode;
  onSelectInstance: (id: string) => void;
  isSelected: boolean;
};

const LayerReorderRow = ({ instance, instances, preview, onSelectInstance, isSelected }: LayerReorderRowProps) => {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const setSidebarHoveredLayerId = useAppStore((s) => s.setSidebarHoveredLayerId);
  const displayName = getInstanceDisplayName(instance);
  const layerSubtitle = getInstanceLayerSubtitle(instance, instances);
  const dragCommittedRef = useRef(false);

  const onGrabPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    const target = event.target;
    if (target instanceof Element && (target.closest("button") || target.closest(".component-list-item-actions"))) {
      return;
    }
    dragCommittedRef.current = false;
    dragControls.start(event, { distanceThreshold: layerDragDistanceThresholdPx });
  };

  return (
    <Reorder.Item
      value={instance.id}
      as="div"
      layout
      className="layers-reorder-item"
      dragListener={false}
      dragControls={dragControls}
      style={{ position: "relative", width: "100%" }}
      whileDrag={{ zIndex: 100 }}
      onDragStart={() => {
        dragCommittedRef.current = true;
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={[
          "layers-reorder-item-surface",
          isSelected ? "layers-reorder-item-surface-selected" : "",
          isDragging ? "layers-reorder-item-surface-dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={onGrabPointerDown}
        onPointerEnter={() => setSidebarHoveredLayerId(instance.id)}
        onClick={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            (target.closest("button") || target.closest(".component-list-item-actions"))
          ) {
            return;
          }
          if (dragCommittedRef.current) {
            dragCommittedRef.current = false;
            return;
          }
          onSelectInstance(instance.id);
        }}
        data-selected={isSelected ? "true" : undefined}
        data-layer-id={instance.id}
      >
        <ComponentListItem
          testId={`layer-item-${instance.id}`}
          preview={preview}
          title={displayName}
          meta={layerSubtitle}
        />
      </div>
    </Reorder.Item>
  );
};

export const ComponentBrowseSidebar = ({
  instances,
  selectedInstance,
  onSelectInstance,
  onStartComponentDrag,
  gridStrokeColor,
  onReorderInstances = () => {},
}: ComponentBrowseSidebarProps) => {
  const scrollThumbFlashComponents = useScrollbarThumbFlash();
  const scrollThumbFlashLayers = useScrollbarThumbFlash();
  const setSidebarHoveredLayerId = useAppStore((s) => s.setSidebarHoveredLayerId);
  const { renderPreview, renderDefinitionPreview } = createSidebarPreviewRenderers(gridStrokeColor);

  useEffect(() => {
    return () => {
      setSidebarHoveredLayerId(null);
    };
  }, [setSidebarHoveredLayerId]);

  return (
    <div className="component-sidebar">
      <section className="component-section">
        <SectionHeading title="Components" />
        <div className="component-scroll-region ui-scroll-overlay" onScroll={scrollThumbFlashComponents}>
          {COMPONENT_DEFINITION_LIST.map((definition) => (
            <ComponentListItem
              key={definition.type}
              as="button"
              onPointerDown={(event) => {
                event.preventDefault();
                onStartComponentDrag(definition.type satisfies ComponentType, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }}
              preview={renderDefinitionPreview(definition)}
              title={definition.label}
            />
          ))}
        </div>
      </section>

      <section className="component-section">
        <SectionHeading title="Layers" />
        <div className="component-scroll-region ui-scroll-overlay" onScroll={scrollThumbFlashLayers}>
          {instances.length ? (
            <Reorder.Group
              axis="y"
              as="div"
              className="layers-reorder-group"
              values={instances.map((inst) => inst.id)}
              onReorder={onReorderInstances}
              onPointerLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setSidebarHoveredLayerId(null);
                }
              }}
            >
              {instances.map((instance) => (
                <LayerReorderRow
                  key={instance.id}
                  instance={instance}
                  instances={instances}
                  preview={renderPreview(instance)}
                  onSelectInstance={onSelectInstance}
                  isSelected={selectedInstance?.id === instance.id}
                />
              ))}
            </Reorder.Group>
          ) : (
            <p className="empty-state">No components on canvas.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export const ComponentConfigSidebar = ({
  instances,
  selectedInstance,
  onUpdateInstanceProps,
  onStartEndpointPick = () => {},
  gridStrokeColor,
}: ComponentConfigSidebarProps) => {
  const onConfigPanelScroll = useScrollbarThumbFlash();
  const { renderPreview, brushFor } = createSidebarPreviewRenderers(gridStrokeColor);

  if (selectedInstance === null) {
    return <div className="component-config-panel component-config-panel-empty" data-testid="layer-config-empty" />;
  }

  if (selectedInstance.type === "connector-line") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <div className="component-config-panel ui-scroll-overlay" onScroll={onConfigPanelScroll}>
        <ComponentListItem
          className="component-config-header"
          testId="component-config-header"
          preview={renderPreview(selectedInstance)}
          title={displayName}
        />
        <label className="field" htmlFor={`connector-preferred-${selectedInstance.id}`}>
          <span>Preferred connection</span>
          <select
            id={`connector-preferred-${selectedInstance.id}`}
            value={selectedInstance.props.preferredConnection}
            onChange={(event) =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                preferredConnection: event.target.value === "vertical" ? "vertical" : "horizontal",
              })
            }
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </label>
        <ConnectorEndpointField
          label="Source"
          endpoint={selectedInstance.props.source}
          instances={instances}
          connector={selectedInstance}
          renderPreview={renderPreview}
          onUpdate={(props) => onUpdateInstanceProps(selectedInstance.id, props)}
          onStartEndpointPick={onStartEndpointPick}
        />
        <ConnectorEndpointField
          label="Target"
          endpoint={selectedInstance.props.target}
          instances={instances}
          connector={selectedInstance}
          renderPreview={renderPreview}
          onUpdate={(props) => onUpdateInstanceProps(selectedInstance.id, props)}
          onStartEndpointPick={onStartEndpointPick}
        />
        <FieldToggle
          label="Overlay grid"
          pressed={selectedInstance.props.overlayGrid}
          testId={`toggle-connector-overlay-grid-${selectedInstance.id}`}
          onToggle={() =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              overlayGrid: !selectedInstance.props.overlayGrid,
            })
          }
        />
        <ConfigSeparator />
        <FieldToggle
          label="Animated"
          pressed={selectedInstance.props.animated}
          testId={`toggle-connector-animated-${selectedInstance.id}`}
          onToggle={() =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              animated: !selectedInstance.props.animated,
            })
          }
        />
      </div>
    );
  }

  if (selectedInstance.type === "plus-marker" || selectedInstance.type === "rect-marker") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <div className="component-config-panel ui-scroll-overlay" onScroll={onConfigPanelScroll}>
        <ComponentListItem
          className="component-config-header"
          testId="component-config-header"
          preview={renderPreview(selectedInstance)}
          title={displayName}
        />
        <ThemeField
          value={selectedInstance.props.theme}
          gridStrokeColor={gridStrokeColor}
          onChange={(theme) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              theme,
            })
          }
        />
      </div>
    );
  }

  const displayName = getInstanceDisplayName(selectedInstance);
  const palette = brushFor(selectedInstance.props.theme);

  return (
    <div className="component-config-panel ui-scroll-overlay" onScroll={onConfigPanelScroll}>
      <ComponentListItem
        className="component-config-header"
        testId="component-config-header"
        preview={renderPreview(selectedInstance)}
        title={displayName}
      />
      <ThemeField
        value={selectedInstance.props.theme}
        gridStrokeColor={gridStrokeColor}
        onChange={(theme) =>
          onUpdateInstanceProps(selectedInstance.id, {
            ...selectedInstance.props,
            theme,
          })
        }
      />
      <IconPickerField
        iconId={selectedInstance.props.iconId}
        iconFill={palette.iconFillHex}
        onIconIdChange={(iconId: IconId) =>
          onUpdateInstanceProps(selectedInstance.id, {
            ...selectedInstance.props,
            iconId,
          })
        }
      />
      <label className="field" htmlFor={`layer-title-${selectedInstance.id}`}>
        <span>Title</span>
        <input
          id={`layer-title-${selectedInstance.id}`}
          type="text"
          value={selectedInstance.props.title}
          onChange={(event) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              title: event.target.value,
            })
          }
        />
      </label>
      {selectedInstance.props.theme !== "neutral" ? (
        <FieldToggle
          label="Match corners with theme"
          pressed={selectedInstance.props.matchCornersWithTheme}
          testId={`toggle-match-corners-${selectedInstance.id}`}
          onToggle={() =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              matchCornersWithTheme: !selectedInstance.props.matchCornersWithTheme,
            })
          }
        />
      ) : null}
      <FieldToggle
        label="Container highlighted"
        pressed={selectedInstance.props.containerHighlighted}
        testId={`toggle-container-highlighted-${selectedInstance.id}`}
        onToggle={() =>
          onUpdateInstanceProps(selectedInstance.id, {
            ...selectedInstance.props,
            containerHighlighted: !selectedInstance.props.containerHighlighted,
          })
        }
      />
    </div>
  );
};

export const ComponentSidebar = (props: ComponentSidebarProps) => (
  <>
    <ComponentBrowseSidebar
      instances={props.instances}
      selectedInstance={props.selectedInstance}
      onSelectInstance={props.onSelectInstance}
      onStartComponentDrag={props.onStartComponentDrag}
      onReorderInstances={props.onReorderInstances}
      gridStrokeColor={props.gridStrokeColor}
    />
    <ComponentConfigSidebar
      instances={props.instances}
      selectedInstance={props.selectedInstance}
      onUpdateInstanceProps={props.onUpdateInstanceProps}
      onStartEndpointPick={props.onStartEndpointPick}
      gridStrokeColor={props.gridStrokeColor}
    />
  </>
);
