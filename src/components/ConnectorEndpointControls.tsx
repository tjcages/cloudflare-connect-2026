import { ChevronDown, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";
import type { FocusEventHandler, ReactNode } from "react";
import { getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import type { ComponentInstance, ConnectorEndpoint, ConnectorLineProps } from "../grid/types";
import { useAppStore } from "../store";
import { ComponentListItem } from "./ComponentListItem";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH, SIDEBAR_LIST_ICON_PX } from "./iconTokens";
import { useScrollbarThumbFlash } from "./useScrollbarThumbFlash";

const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;

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
  const setSidebarHoveredLayerId = useAppStore((s) => s.setSidebarHoveredLayerId);
  const onOptionsScroll = useScrollbarThumbFlash();
  const selectableLayers = instances.filter(
    (instance) => instance.type === "icon-box" || instance.type === "icon-box-2x1",
  );
  const selectedLayer =
    endpoint.kind === "layer" ? (instances.find((instance) => instance.id === endpoint.instanceId) ?? null) : null;
  const selectedTitle = selectedLayer ? getInstanceDisplayName(selectedLayer) : "Static cell";
  const selectedMeta = selectedLayer
    ? getInstanceLayerSubtitle(selectedLayer, instances)
    : getEndpointCellMeta(endpoint);
  const selectedPreview = selectedLayer ? renderPreview(selectedLayer) : <StaticCellIcon />;

  useEffect(() => {
    if (!open) {
      setSidebarHoveredLayerId(null);
    }
  }, [open, setSidebarHoveredLayerId]);

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
        <div
          className="connector-endpoint-options ui-scroll-overlay"
          onScroll={onOptionsScroll}
          onPointerLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSidebarHoveredLayerId(null);
            }
          }}
        >
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
            onPointerEnter={() => setSidebarHoveredLayerId(null)}
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
                onPointerEnter={() => setSidebarHoveredLayerId(instance.id)}
                onClick={() => selectEndpoint({ kind: "layer", instanceId: instance.id })}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export type ConnectorEndpointFieldProps = {
  label: "Source" | "Target";
  endpoint: ConnectorEndpoint;
  instances: ComponentInstance[];
  connector: Extract<ComponentInstance, { type: "connector-line" }>;
  renderPreview: (instance: ComponentInstance) => ReactNode;
  onUpdate: (props: ConnectorLineProps) => void;
  onStartEndpointPick: (id: string, endpoint: "source" | "target") => void;
};

export const ConnectorEndpointField = ({
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
