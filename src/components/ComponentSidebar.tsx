import { ChevronDown, Crosshair } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useRef, useState } from "react";
import type { FocusEventHandler, PointerEventHandler, ReactNode } from "react";
import { COMPONENT_REGISTRY, getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import { ICON_OPTIONS } from "../lib/iconRegistry";
import { ComponentIcon } from "./ComponentIcon";
import { ComponentListItem } from "./ComponentListItem";
import { PlusMarkerGlyph } from "./PlusMarkerGlyph";
import { RectMarkerGlyph } from "./RectMarkerGlyph";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH, SIDEBAR_LIST_ICON_PX } from "./iconTokens";
import type {
  ComponentInstance,
  ComponentProps,
  ComponentType,
  ConnectorEndpoint,
  ConnectorLineProps,
  IconBoxProps,
  IconId,
  PlusMarkerProps,
  RectMarkerProps,
} from "../grid/types";
import { PALETTE_THEMES, type PaletteThemeId, paletteBrush } from "../theme/palette";

type PaletteThemePickerProps = {
  value: PaletteThemeId;
  onChange: (id: PaletteThemeId) => void;
  gridStrokeColor?: string;
};

const PaletteThemePicker = ({ value, onChange, gridStrokeColor }: PaletteThemePickerProps) => (
  <div className="palette-theme-picker" data-testid="palette-theme-picker">
    {PALETTE_THEMES.map((theme) => {
      const selected = value === theme.id;
      const strokeTrim = gridStrokeColor?.trim() ?? "";
      const neutralSyncedFill = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillHex;
      const neutralSyncedP3 = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillDisplayP3;
      return (
        <button
          key={theme.id}
          type="button"
          data-testid={`palette-theme-swatch-${theme.id}`}
          data-selected={selected ? "true" : undefined}
          className="palette-theme-swatch"
          style={{
            borderColor: selected ? neutralSyncedFill : "#f3f3f3",
            ["--palette-fill-fallback" as string]: neutralSyncedFill,
            ["--palette-fill-p3" as string]: neutralSyncedP3,
          }}
          onClick={() => onChange(theme.id)}
        >
          <span className="palette-theme-swatch-fill" />
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

const componentTypes = Object.values(COMPONENT_REGISTRY);
const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;
const CONNECTOR_LINE_ICON_COLOR = paletteBrush("neutral").iconFillHex;

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
  <Crosshair className="component-icon" size={size} strokeWidth={ICON_STROKE_WIDTH} />
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
        testId={`connector-endpoint-trigger-${label.toLowerCase()}`}
        className="connector-endpoint-select-trigger"
        preview={selectedPreview}
        title={selectedTitle}
        meta={selectedMeta}
        actions={<ChevronDown size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div className="connector-endpoint-options">
          <ComponentListItem
            as="button"
            testId="connector-endpoint-option-static-cell"
            className={[
              "connector-endpoint-option",
              endpoint.kind === "cell" ? "connector-endpoint-option-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            preview={<StaticCellIcon />}
            title="Static cell"
            meta={getEndpointCellMeta(endpoint.kind === "cell" ? endpoint : fallbackCell)}
            onClick={() => selectEndpoint(endpoint.kind === "cell" ? endpoint : fallbackCell)}
          />
          {selectableLayers.map((instance) => {
            const layerSubtitle = getInstanceLayerSubtitle(instance, instances);
            const layerSelected = endpoint.kind === "layer" && endpoint.instanceId === instance.id;
            return (
              <ComponentListItem
                key={instance.id}
                as="button"
                testId={`connector-endpoint-option-layer-${instance.id}`}
                className={["connector-endpoint-option", layerSelected ? "connector-endpoint-option-selected" : ""]
                  .filter(Boolean)
                  .join(" ")}
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
          data-testid={`connector-pick-${key}-cell`}
          onClick={() => onStartEndpointPick(connector.id, key)}
        >
          <Crosshair size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />
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
    instance.type === "connector-line" ? (
      <ConnectorLineIcon />
    ) : instance.type === "plus-marker" ? (
      <PlusMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : instance.type === "rect-marker" ? (
      <RectMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : (
      renderIcon(instance.props)
    );
  const renderDefinitionPreview = (definition: (typeof componentTypes)[number]) =>
    definition.type === "connector-line" ? (
      <ConnectorLineIcon />
    ) : definition.type === "plus-marker" ? (
      <PlusMarkerGlyph theme={(definition.defaultProps as PlusMarkerProps).theme} gridStrokeColor={gridStrokeColor} />
    ) : definition.type === "rect-marker" ? (
      <RectMarkerGlyph theme={(definition.defaultProps as RectMarkerProps).theme} gridStrokeColor={gridStrokeColor} />
    ) : (
      renderIcon(definition.defaultProps as IconBoxProps)
    );

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
        <div className="component-scroll-region">
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
  if (selectedInstance === null) {
    return <div className="component-config-panel component-config-panel-empty" data-testid="layer-config-empty" />;
  }

  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const brushFor = (theme: PaletteThemeId) => paletteBrush(theme, neutralOpts);
  const renderIcon = (props: IconBoxProps) => (
    <ComponentIcon iconId={props.iconId} color={brushFor(props.theme).iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
  );
  const renderPreview = (instance: ComponentInstance) =>
    instance.type === "connector-line" ? (
      <ConnectorLineIcon />
    ) : instance.type === "plus-marker" ? (
      <PlusMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : instance.type === "rect-marker" ? (
      <RectMarkerGlyph theme={instance.props.theme} gridStrokeColor={gridStrokeColor} />
    ) : (
      renderIcon(instance.props)
    );

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
        <div className="field field-toggle-row">
          <span>Overlay grid</span>
          <button
            type="button"
            data-testid={`toggle-connector-overlay-grid-${selectedInstance.id}`}
            className={["field-toggle-switch", selectedInstance.props.overlayGrid ? "field-toggle-switch-on" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                overlayGrid: !selectedInstance.props.overlayGrid,
              })
            }
          />
        </div>
        <hr className="component-config-section-separator" role="presentation" />
        <div className="field field-toggle-row">
          <span>Animated</span>
          <button
            type="button"
            data-testid={`toggle-connector-animated-${selectedInstance.id}`}
            className={["field-toggle-switch", selectedInstance.props.animated ? "field-toggle-switch-on" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                animated: !selectedInstance.props.animated,
              })
            }
          />
        </div>
      </div>
    );
  }

  if (selectedInstance.type === "plus-marker" || selectedInstance.type === "rect-marker") {
    const displayName = getInstanceDisplayName(selectedInstance);
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
        <div className="icon-picker" data-testid="icon-picker">
          {ICON_OPTIONS.map((icon) => {
            const selected = selectedInstance.props.iconId === icon.id;
            return (
              <button
                key={icon.id}
                className={selected ? "icon-picker-button icon-picker-button-active" : "icon-picker-button"}
                type="button"
                data-testid={`icon-picker-${icon.id}`}
                data-selected={selected ? "true" : undefined}
                onClick={() =>
                  onUpdateInstanceProps(selectedInstance.id, {
                    ...selectedInstance.props,
                    iconId: icon.id as IconId,
                  })
                }
              >
                <ComponentIcon iconId={icon.id as IconId} color={palette.iconFillHex} size={SIDEBAR_LIST_ICON_PX} />
              </button>
            );
          })}
        </div>
      </div>
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
        <div className="field field-toggle-row">
          <span>Match corners with theme</span>
          <button
            type="button"
            data-testid={`toggle-match-corners-${selectedInstance.id}`}
            className={[
              "field-toggle-switch",
              selectedInstance.props.matchCornersWithTheme ? "field-toggle-switch-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
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
        <span>Container highlighted</span>
        <button
          type="button"
          data-testid={`toggle-container-highlighted-${selectedInstance.id}`}
          className={[
            "field-toggle-switch",
            selectedInstance.props.containerHighlighted ? "field-toggle-switch-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
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
    <ComponentConfigSidebar
      instances={props.instances}
      selectedInstance={props.selectedInstance}
      onUpdateInstanceProps={props.onUpdateInstanceProps}
      onStartEndpointPick={props.onStartEndpointPick}
      gridStrokeColor={props.gridStrokeColor}
    />
  </>
);
