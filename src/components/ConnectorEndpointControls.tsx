import { ChevronDown, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";
import type { FocusEventHandler, ReactNode } from "react";
import { getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import type { ComponentInstance, ConnectorEndpoint, ConnectorLineProps } from "../grid/types";
import { cn } from "../lib/cn";
import { useAppStore } from "../store";
import { ComponentListItem } from "./ComponentListItem";
import { BuilderField } from "./BuilderField";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH, SIDEBAR_LIST_ICON_PX } from "./iconTokens";
import { useScrollbarThumbFlash } from "./useScrollbarThumbFlash";

const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;

const getEndpointCellMeta = (endpoint: ConnectorEndpoint) =>
  endpoint.kind === "cell" ? `x: ${endpoint.x}, y: ${endpoint.y}` : undefined;

const StaticCellIcon = ({ size = SIDEBAR_LIST_ICON_PX }: { size?: number }) => (
  <Crosshair className="block" size={size} strokeWidth={ICON_STROKE_WIDTH} />
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
    <div className="relative min-w-0" onBlur={onBlur}>
      <ComponentListItem
        as="button"
        persistActionsOpacity
        testId={`connector-endpoint-trigger-${label.toLowerCase()}`}
        className="min-h-[42px] items-start rounded-md border border-builder-hairline py-2 pl-2.5 pr-2.5"
        preview={selectedPreview}
        title={selectedTitle}
        meta={selectedMeta}
        actions={<ChevronDown size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div
          className="ui-scroll-overlay absolute left-0 right-0 top-full z-20 mt-1 max-h-[180px] overflow-auto overflow-x-hidden rounded-md border border-builder-hairline bg-builder-surface py-1 shadow-[0_8px_20px_rgb(0_0_0/0.06)]"
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
            className={cn("items-start py-2 pl-2.5 pr-2.5", endpoint.kind === "cell" && "bg-builder-hover-row")}
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
                className={cn("items-start py-2 pl-2.5 pr-2.5", layerSelected && "bg-builder-hover-row")}
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
    <BuilderField>
      <span>{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-1.5">
        <EndpointSelect
          label={label}
          endpoint={endpoint}
          instances={instances}
          renderPreview={renderPreview}
          fallbackCell={{ kind: "cell", x: connector.x, y: connector.y }}
          onSelect={updateEndpoint}
        />
        <button
          className="box-border grid aspect-square min-h-0 w-auto min-w-[42px] max-w-[42px] shrink-0 cursor-pointer place-items-center self-stretch border border-builder-hairline bg-builder-surface p-0 text-builder-control hover:bg-builder-hover-surface hover:text-builder-muted active:bg-builder-active-surface"
          type="button"
          data-testid={`connector-pick-${key}-cell`}
          onClick={() => onStartEndpointPick(connector.id, key)}
        >
          <Crosshair size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />
        </button>
      </div>
    </BuilderField>
  );
};
