import { ChevronDown, Crosshair } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { FocusEventHandler, PointerEventHandler, ReactNode } from "react";
import { COMPONENT_REGISTRY, getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import { ICON_OPTIONS } from "../lib/iconRegistry";
import { ComponentIcon } from "./ComponentIcon";
import { ComponentListItem } from "./ComponentListItem";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH, SIDEBAR_LIST_ICON_PX } from "./iconTokens";
import type {
  ComponentInstance,
  ComponentProps,
  ComponentType,
  ConnectorEndpoint,
  ConnectorLineProps,
  IconBoxProps,
  IconId,
} from "../grid/types";
import { PALETTE_THEMES, type PaletteThemeId, paletteBrush } from "../theme/palette";

type PaletteThemePickerProps = {
  ariaLabel: string;
  value: PaletteThemeId;
  onChange: (id: PaletteThemeId) => void;
  gridStrokeColor?: string;
};

const PaletteThemePicker = ({ ariaLabel, value, onChange, gridStrokeColor }: PaletteThemePickerProps) => (
  <div className="palette-theme-picker" role="radiogroup" aria-label={ariaLabel}>
    {PALETTE_THEMES.map((theme) => {
      const selected = value === theme.id;
      const strokeTrim = gridStrokeColor?.trim() ?? "";
      const neutralSyncedFill = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillHex;
      const neutralSyncedP3 = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillDisplayP3;
      return (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={theme.label}
          className="palette-theme-swatch"
          style={{
            borderColor: selected ? neutralSyncedFill : "#f3f3f3",
            ["--palette-fill-fallback" as string]: neutralSyncedFill,
            ["--palette-fill-p3" as string]: neutralSyncedP3,
          }}
          onClick={() => onChange(theme.id)}
        >
          <span className="palette-theme-swatch-fill" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

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
  selectedInstance: ComponentInstance;
  onUpdateInstanceProps: (id: string, props: ComponentProps) => void;
  onStartEndpointPick?: (id: string, endpoint: "source" | "target") => void;
  /** When set, neutral theme fills track this hex (same source as grid stroke). */
  gridStrokeColor?: string;
};

export type ComponentSidebarProps = ComponentBrowseSidebarProps & {
  onUpdateInstanceProps: (id: string, props: ComponentProps) => void;
  onStartEndpointPick?: (id: string, endpoint: "source" | "target") => void;
};

const componentTypes = Object.values(COMPONENT_REGISTRY);
const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;
const CONNECTOR_LINE_ICON_COLOR = paletteBrush("neutral").iconFillHex;

const getLayerActionLabel = (verb: string, displayName: string, subtitle: string | undefined) =>
  subtitle ? `${verb} ${displayName}, ${subtitle}` : `${verb} ${displayName}`;

const layerDragDistanceThresholdPx = 10;

const ConnectorLineIcon = ({ size = SIDEBAR_LIST_ICON_PX }: { size?: number }) => (
  <svg
    className="component-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.7}
    style={{ color: CONNECTOR_LINE_ICON_COLOR }}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M5 9h6v6h8" />
    <path d="M5 9h0.01" />
    <path d="M19 15h0.01" />
  </svg>
);

const getEndpointSelectedLayer = (endpoint: ConnectorEndpoint, instances: ComponentInstance[]) => {
  if (endpoint.kind !== "layer") {
    return null;
  }
  return instances.find((instance) => instance.id === endpoint.instanceId) ?? null;
};

const getEndpointCellMeta = (endpoint: ConnectorEndpoint) =>
  endpoint.kind === "cell" ? `x: ${endpoint.x}, y: ${endpoint.y}` : undefined;

const StaticCellIcon = ({ size = SIDEBAR_LIST_ICON_PX }: { size?: number }) => (
  <Crosshair
    className="component-icon"
    size={size}
    strokeWidth={ICON_STROKE_WIDTH}
    aria-hidden="true"
    focusable="false"
  />
);

type EndpointSelectProps = {
  label: "Source" | "Target";
  endpoint: ConnectorEndpoint;
  instances: ComponentInstance[];
  renderPreview: (instance: ComponentInstance) => ReactNode;
  onSelect: (endpoint: ConnectorEndpoint) => void;
  fallbackCell: ConnectorEndpoint;
};

const EndpointSelect = ({ label, endpoint, instances, renderPreview, onSelect, fallbackCell }: EndpointSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectableLayers = instances.filter((instance) => instance.type !== "connector-line");
  const selectedLayer = getEndpointSelectedLayer(endpoint, selectableLayers);
  const selectedTitle = selectedLayer ? getInstanceDisplayName(selectedLayer) : "Static cell";
  const selectedMeta = selectedLayer ? getInstanceLayerSubtitle(selectedLayer) : getEndpointCellMeta(endpoint);
  const selectedPreview = selectedLayer ? renderPreview(selectedLayer) : <StaticCellIcon />;
  const listboxId = `${label.toLowerCase()}-endpoint-options`;

  const onBlur: FocusEventHandler<HTMLDivElement> = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  const selectEndpoint = (next: ConnectorEndpoint) => {
    onSelect(next);
    setOpen(false);
  };

  return (
    <div className="connector-endpoint-select" onBlur={onBlur}>
      <ComponentListItem
        as="button"
        className="connector-endpoint-select-trigger"
        ariaLabel={`${label} endpoint`}
        ariaExpanded={open}
        ariaHasPopup="listbox"
        preview={selectedPreview}
        title={selectedTitle}
        meta={selectedMeta}
        actions={
          <ChevronDown size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
        }
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div id={listboxId} className="connector-endpoint-options" role="listbox" aria-label={`${label} endpoint`}>
          <ComponentListItem
            as="button"
            role="option"
            className="connector-endpoint-option"
            ariaSelected={endpoint.kind === "cell"}
            preview={<StaticCellIcon />}
            title="Static cell"
            meta={getEndpointCellMeta(endpoint.kind === "cell" ? endpoint : fallbackCell)}
            onClick={() => selectEndpoint(endpoint.kind === "cell" ? endpoint : fallbackCell)}
          />
          {selectableLayers.map((instance) => {
            const layerSubtitle = getInstanceLayerSubtitle(instance, instances);
            return (
              <ComponentListItem
                key={instance.id}
                as="button"
                role="option"
                className="connector-endpoint-option"
                ariaSelected={endpoint.kind === "layer" && endpoint.instanceId === instance.id}
                preview={renderPreview(instance)}
                title={getInstanceDisplayName(instance)}
                meta={layerSubtitle}
                onClick={() => selectEndpoint({ kind: "layer", instanceId: instance.id })}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

type ConnectorEndpointFieldProps = {
  label: "Source" | "Target";
  endpoint: ConnectorEndpoint;
  instances: ComponentInstance[];
  connector: Extract<ComponentInstance, { type: "connector-line" }>;
  renderPreview: (instance: ComponentInstance) => ReactNode;
  onUpdate: (props: ConnectorLineProps) => void;
  onStartEndpointPick: (id: string, endpoint: "source" | "target") => void;
};

const ConnectorEndpointField = ({
  label,
  endpoint,
  instances,
  connector,
  renderPreview,
  onUpdate,
  onStartEndpointPick,
}: ConnectorEndpointFieldProps) => {
  const key = label.toLowerCase() as "source" | "target";
  const updateEndpoint = (next: ConnectorEndpoint) => {
    onUpdate({
      ...connector.props,
      [key]: next,
    });
  };

  return (
    <div className="field connector-endpoint-field">
      <span>{label}</span>
      <div className="connector-endpoint-row">
        <EndpointSelect
          label={label}
          endpoint={endpoint}
          instances={instances}
          renderPreview={renderPreview}
          fallbackCell={{ kind: "cell", x: connector.x, y: connector.y }}
          onSelect={updateEndpoint}
        />
        <button
          className="component-row-icon-button connector-endpoint-pick-button"
          type="button"
          aria-label={`Pick ${key} cell on canvas`}
          onClick={() => onStartEndpointPick(connector.id, key)}
        >
          <Crosshair size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
        </button>
      </div>
    </div>
  );
};

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
  const displayName = getInstanceDisplayName(instance);
  const layerSubtitle = getInstanceLayerSubtitle(instance, instances);
  /** Set when this row's drag passes Motion's threshold; prevents treating a reorder as a select on click. */
  const dragCommittedRef = useRef(false);

  const onGrabPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    const target = event.target;
    if (target instanceof Element && (target.closest("button") || target.closest(".component-list-item-actions"))) {
      return;
    }
    dragCommittedRef.current = false;
    dragControls.start(event, { distanceThreshold: layerDragDistanceThresholdPx });
  };

  const layerSelectLabel = getLayerActionLabel("Select", displayName, layerSubtitle);

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
      {/* Row surface: Motion drag + click; keep the wrapper non-button to avoid nested controls. */}
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
          ariaLabel={layerSelectLabel}
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
  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const brushFor = (theme: PaletteThemeId) => paletteBrush(theme, neutralOpts);
  const renderIcon = (props: IconBoxProps) => (
    <ComponentIcon iconId={props.iconId} color={brushFor(props.theme).iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
  );
  const renderPreview = (instance: ComponentInstance) =>
    instance.type === "connector-line" ? <ConnectorLineIcon /> : renderIcon(instance.props);
  const renderDefinitionPreview = (definition: (typeof componentTypes)[number]) =>
    definition.type === "connector-line" ? <ConnectorLineIcon /> : renderIcon(definition.defaultProps as IconBoxProps);

  const layersScrollRegionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const id = selectedInstance?.id;
    if (id == null) {
      return undefined;
    }

    const scrollLayerRowIntoList = () => {
      const container = layersScrollRegionRef.current;
      if (!container) {
        return;
      }
      const row = container.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
      if (!row) {
        return;
      }

      const cr = container.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      let nextTop = container.scrollTop;
      let nextLeft = container.scrollLeft;

      if (rr.top < cr.top) {
        nextTop += rr.top - cr.top;
      } else if (rr.bottom > cr.bottom) {
        nextTop += rr.bottom - cr.bottom;
      }

      if (rr.left < cr.left) {
        nextLeft += rr.left - cr.left;
      } else if (rr.right > cr.right) {
        nextLeft += rr.right - cr.right;
      }

      if (typeof container.scrollTo === "function") {
        container.scrollTo({
          top: nextTop,
          left: nextLeft,
          behavior: "instant",
        });
      } else {
        container.scrollTop = nextTop;
        container.scrollLeft = nextLeft;
      }
    };

    scrollLayerRowIntoList();
    const outerRaf = requestAnimationFrame(() => {
      requestAnimationFrame(scrollLayerRowIntoList);
    });
    return () => cancelAnimationFrame(outerRaf);
  }, [selectedInstance?.id]);

  return (
    <div className="component-sidebar">
      <section className="component-section">
        <div className="section-heading">
          <span>Components</span>
        </div>
        <div className="component-scroll-region">
          {componentTypes.map((definition) => (
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
        <div className="section-heading">
          <span>Layers</span>
        </div>
        <div className="component-scroll-region" ref={layersScrollRegionRef}>
          {instances.length ? (
            <Reorder.Group
              axis="y"
              as="div"
              className="layers-reorder-group"
              values={instances.map((inst) => inst.id)}
              onReorder={onReorderInstances}
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
  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const brushFor = (theme: PaletteThemeId) => paletteBrush(theme, neutralOpts);
  const renderIcon = (props: IconBoxProps) => (
    <ComponentIcon iconId={props.iconId} color={brushFor(props.theme).iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
  );
  const renderPreview = (instance: ComponentInstance) =>
    instance.type === "connector-line" ? <ConnectorLineIcon /> : renderIcon(instance.props);

  if (selectedInstance.type === "connector-line") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <div className="component-config-panel">
        <ComponentListItem
          className="component-config-header"
          testId="component-config-header"
          preview={renderPreview(selectedInstance)}
          title={displayName}
        />
        <label className="field">
          <span>Preferred connection</span>
          <select
            aria-label="Preferred connection"
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
      </div>
    );
  }

  const displayName = getInstanceDisplayName(selectedInstance);
  const palette = brushFor(selectedInstance.props.theme);
  return (
    <div className="component-config-panel">
      <ComponentListItem
        className="component-config-header"
        testId="component-config-header"
        preview={renderPreview(selectedInstance)}
        title={displayName}
      />
      <div className="field">
        <span>Theme</span>
        <PaletteThemePicker
          ariaLabel="Theme"
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
      <div className="field">
        <span>Icon</span>
        <div className="icon-picker" role="radiogroup" aria-label="Icon">
          {ICON_OPTIONS.map((icon) => (
            <button
              key={icon.id}
              className={
                selectedInstance.props.iconId === icon.id
                  ? "icon-picker-button icon-picker-button-active"
                  : "icon-picker-button"
              }
              type="button"
              role="radio"
              aria-checked={selectedInstance.props.iconId === icon.id}
              aria-label={icon.label}
              onClick={() =>
                onUpdateInstanceProps(selectedInstance.id, {
                  ...selectedInstance.props,
                  iconId: icon.id as IconId,
                })
              }
            >
              <ComponentIcon iconId={icon.id as IconId} color={palette.iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={selectedInstance.props.title}
          onChange={(event) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              title: event.target.value,
            })
          }
          aria-label="Title"
        />
      </label>
      {selectedInstance.props.theme !== "neutral" ? (
        <div className="field field-toggle-row">
          <span id={`corner-match-label-${selectedInstance.id}`}>Match corners with theme</span>
          <button
            type="button"
            role="switch"
            className="field-toggle-switch"
            aria-labelledby={`corner-match-label-${selectedInstance.id}`}
            aria-checked={selectedInstance.props.matchCornersWithTheme}
            onClick={() =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                matchCornersWithTheme: !selectedInstance.props.matchCornersWithTheme,
              })
            }
          />
        </div>
      ) : null}
      <div className="field field-toggle-row">
        <span id={`container-highlighted-label-${selectedInstance.id}`}>Container highlighted</span>
        <button
          type="button"
          role="switch"
          className="field-toggle-switch"
          aria-labelledby={`container-highlighted-label-${selectedInstance.id}`}
          aria-checked={selectedInstance.props.containerHighlighted}
          onClick={() =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              containerHighlighted: !selectedInstance.props.containerHighlighted,
            })
          }
        />
      </div>
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
    {props.selectedInstance ? (
      <ComponentConfigSidebar
        instances={props.instances}
        selectedInstance={props.selectedInstance}
        onUpdateInstanceProps={props.onUpdateInstanceProps}
        onStartEndpointPick={props.onStartEndpointPick}
        gridStrokeColor={props.gridStrokeColor}
      />
    ) : null}
  </>
);
