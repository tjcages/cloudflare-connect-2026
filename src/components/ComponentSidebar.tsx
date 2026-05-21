import { Reorder, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PointerEventHandler, ReactNode } from "react";
import { getComponentDefinition, getInstanceLayerSubtitle } from "../lib/componentRegistry";
import { isIconBoxLayerConnectorTarget } from "../lib/iconBoxEnabledByLine";
import { isIconBoxInstance } from "../lib/icon-box/layout";
import { isInteractiveListChromeTarget } from "../lib/isInteractiveListChromeTarget";
import { cn } from "../lib/cn";
import { useAppStore } from "../store";
import type { ComponentInstance, ComponentProps, ComponentType, IconId } from "../grid/types";
import { ComponentListItem } from "./ComponentListItem";
import { BuilderSelectField } from "./BuilderSelectField";
import { CodeSnippetCodeField } from "./CodeSnippetCodeField";
import { BuilderTextField } from "./BuilderTextField";
import { ConnectorEndpointField } from "./ConnectorEndpointControls";
import { ConfigDebugDisclosure } from "./ConfigDebugDisclosure";
import { ConfigSeparator } from "./ConfigSeparator";
import { FieldToggle } from "./FieldToggle";
import { IconPickerField } from "./IconPickerField";
import { IconBoxLayoutFields } from "./IconBoxLayoutFields";
import { LayerConfigPanel } from "./LayerConfigPanel";
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
    if (target instanceof Element && isInteractiveListChromeTarget(target)) {
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
      className="z-0 w-full min-w-0 select-none"
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
        data-layer-surface
        className={cn(
          "w-full min-w-0 select-none",
          isSelected ? "bg-builder-selected-row hover:bg-builder-selected-row-hover" : "hover:bg-builder-hover-row",
          isDragging && "cursor-grabbing",
          !isDragging && "cursor-pointer",
        )}
        onPointerDown={onGrabPointerDown}
        onPointerEnter={() => setSidebarHoveredLayerId(instance.id)}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && isInteractiveListChromeTarget(target)) {
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
          textAlignTop
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
    <div className="flex min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-[50vh] flex-col gap-0 py-3.5">
        <SectionHeading title="Components" />
        <div
          className="ui-scroll-overlay grid min-h-0 flex-1 auto-rows-min content-start gap-0 overflow-x-hidden overflow-y-auto"
          onScroll={scrollThumbFlashComponents}
        >
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

      <section className="flex min-h-[50vh] flex-col gap-0 border-t border-builder-hairline py-3.5">
        <SectionHeading title="Layers" />
        <div
          className="ui-scroll-overlay grid min-h-0 flex-1 auto-rows-min content-start gap-0 overflow-x-hidden overflow-y-auto"
          onScroll={scrollThumbFlashLayers}
        >
          {instances.length ? (
            <Reorder.Group
              axis="y"
              as="div"
              className="isolate grid w-full min-w-0 auto-rows-min content-start gap-0 select-none"
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
            <p className="px-3.5 text-[10px] text-builder-subtle">No components on canvas.</p>
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
  const lineEnableDebugTargetId = selectedInstance && isIconBoxInstance(selectedInstance) ? selectedInstance.id : null;
  const lineEnableDebugRow = useAppStore((s) =>
    lineEnableDebugTargetId ? s.iconBoxLineEnableDebug[lineEnableDebugTargetId] : undefined,
  );

  if (selectedInstance === null) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3.5" data-testid="layer-config-empty" />;
  }

  if (selectedInstance.type === "connector-line") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <LayerConfigPanel
        onScroll={onConfigPanelScroll}
        title={displayName}
        headerPreview={renderPreview(selectedInstance)}
      >
        <BuilderSelectField
          label="Preferred connection"
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
        </BuilderSelectField>
        <BuilderSelectField
          label="Style"
          id={`connector-style-${selectedInstance.id}`}
          value={selectedInstance.props.style}
          onChange={(event) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              style: event.target.value === "dashed" ? "dashed" : "solid",
            })
          }
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
        </BuilderSelectField>
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
        {selectedInstance.props.target.kind === "cell" ? (
          <BuilderSelectField
            label="Static end leg"
            id={`connector-static-end-leg-${selectedInstance.id}`}
            value={selectedInstance.props.staticEndLeg}
            onChange={(event) => {
              const value = event.target.value;
              const staticEndLeg =
                value === "top" || value === "right" || value === "bottom" || value === "left" ? value : "unset";
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                staticEndLeg,
              });
            }}
          >
            <option value="unset">Unset</option>
            <option value="top">Top</option>
            <option value="right">Right</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
          </BuilderSelectField>
        ) : null}
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
      </LayerConfigPanel>
    );
  }

  if (selectedInstance.type === "code-snippet") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <LayerConfigPanel
        onScroll={onConfigPanelScroll}
        title={displayName}
        headerPreview={renderPreview(selectedInstance)}
      >
        <CodeSnippetCodeField
          id={`layer-code-${selectedInstance.id}`}
          value={selectedInstance.props.code}
          language={selectedInstance.props.language}
          onChange={(code) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              code,
            })
          }
        />
        <BuilderSelectField
          label="Language"
          id={`layer-language-${selectedInstance.id}`}
          value={selectedInstance.props.language}
          onChange={(event) =>
            onUpdateInstanceProps(selectedInstance.id, {
              ...selectedInstance.props,
              language: event.target.value as typeof selectedInstance.props.language,
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="json">JSON</option>
          <option value="bash">Bash</option>
          <option value="text">Plain text</option>
        </BuilderSelectField>
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
      </LayerConfigPanel>
    );
  }

  if (selectedInstance.type === "plus-marker" || selectedInstance.type === "rect-marker") {
    const displayName = getInstanceDisplayName(selectedInstance);
    return (
      <LayerConfigPanel
        onScroll={onConfigPanelScroll}
        title={displayName}
        headerPreview={renderPreview(selectedInstance)}
      >
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
      </LayerConfigPanel>
    );
  }

  const displayName = getInstanceDisplayName(selectedInstance);
  const palette = brushFor(selectedInstance.props.theme);

  return (
    <LayerConfigPanel
      onScroll={onConfigPanelScroll}
      title={displayName}
      headerPreview={renderPreview(selectedInstance)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex shrink-0 flex-col gap-3.5">
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
          <IconBoxLayoutFields
            instanceId={selectedInstance.id}
            length={selectedInstance.props.length}
            direction={selectedInstance.props.direction}
            onLengthChange={(nextLength) =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                length: nextLength,
              })
            }
            onDirectionChange={(nextDirection) =>
              onUpdateInstanceProps(selectedInstance.id, {
                ...selectedInstance.props,
                direction: nextDirection,
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
          <BuilderTextField
            label="Title"
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
          {isIconBoxLayerConnectorTarget(instances, selectedInstance.id) ? (
            <>
              <ConfigSeparator />
              <BuilderSelectField
                label="Enabled by line"
                id={`layer-enabled-by-line-${selectedInstance.id}`}
                value={selectedInstance.props.enabledByLine}
                onChange={(event) => {
                  const value = event.target.value;
                  const enabledByLine = value === "once" ? "once" : value === "iterated" ? "iterated" : "off";
                  onUpdateInstanceProps(selectedInstance.id, {
                    ...selectedInstance.props,
                    enabledByLine,
                  });
                }}
              >
                <option value="off">Off</option>
                <option value="once">Once</option>
                <option value="iterated">Iterated</option>
              </BuilderSelectField>
            </>
          ) : null}
        </div>
        <ConfigDebugDisclosure testId="line-enable-debug-accordion">
          {!lineEnableDebugRow ? (
            <p className="m-0 leading-snug">
              No line-enable coordinator snapshot yet. Open the canvas with this layer mounted and set{" "}
              <span className="text-builder-foreground">Enabled by line</span> to Once or Iterated to populate counters
              here.
            </p>
          ) : (
            <table className="w-full min-w-0 border-collapse text-left">
              <tbody>
                <tr className="align-top">
                  <th className="pr-2 font-normal">hitCount</th>
                  <td className="font-mono text-builder-foreground">{lineEnableDebugRow.hitCount}</td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">onceLatched</th>
                  <td className="font-mono text-builder-foreground">
                    {lineEnableDebugRow.onceLatched ? "true" : "false"}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">logicalEnabled</th>
                  <td className="font-mono text-builder-foreground">
                    {lineEnableDebugRow.logicalEnabled ? "true" : "false"}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">visualEnabled</th>
                  <td className="font-mono text-builder-foreground">
                    {lineEnableDebugRow.visualEnabled ? "true" : "false"}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">colorBusy</th>
                  <td className="font-mono text-builder-foreground">
                    {lineEnableDebugRow.colorBusy ? "true" : "false"}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">hasHandles</th>
                  <td className="font-mono text-builder-foreground">
                    {lineEnableDebugRow.hasHandles ? "true" : "false"}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">outgoing</th>
                  <td className="font-mono text-builder-foreground">
                    active {lineEnableDebugRow.outgoingActive} / waiting {lineEnableDebugRow.outgoingWaiting}
                  </td>
                </tr>
                <tr className="align-top">
                  <th className="pr-2 font-normal">updatedAt</th>
                  <td className="font-mono text-builder-foreground">{lineEnableDebugRow.updatedAt}</td>
                </tr>
              </tbody>
            </table>
          )}
        </ConfigDebugDisclosure>
      </div>
    </LayerConfigPanel>
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
