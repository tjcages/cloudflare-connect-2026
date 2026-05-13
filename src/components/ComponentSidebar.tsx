import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { ComponentIcon } from "./ComponentIcon";
import { COMPONENT_REGISTRY, getComponentDefinition } from "./componentRegistry";
import { ComponentListItem } from "./ComponentListItem";
import { ICON_OPTIONS } from "./iconRegistry";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH } from "./iconTokens";
import type { ComponentInstance, ComponentType, IconBoxProps, IconId } from "../grid/types";

type ComponentSidebarProps = {
  instances: ComponentInstance[];
  selectedInstance: ComponentInstance | null;
  onSelectInstance: (id: string) => void;
  onBack: () => void;
  onDeleteInstance: (id: string) => void;
  onUpdateInstanceProps: (id: string, props: IconBoxProps) => void;
  onStartComponentDrag: (type: ComponentType) => void;
};

const componentTypes = Object.values(COMPONENT_REGISTRY);
const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;
const renderIcon = (props: IconBoxProps) => <ComponentIcon iconId={props.iconId} color={props.iconColor} size={16} />;

export const ComponentSidebar = ({
  instances,
  selectedInstance,
  onSelectInstance,
  onBack,
  onDeleteInstance,
  onUpdateInstanceProps,
  onStartComponentDrag,
}: ComponentSidebarProps) => {
  if (selectedInstance) {
    const displayName = getInstanceDisplayName(selectedInstance);

    return (
      <div className="component-config-panel">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
          Back
        </button>
        <ComponentListItem
          className="component-config-header"
          testId="component-config-header"
          preview={renderIcon(selectedInstance.props)}
          title={displayName}
          meta={`x: ${selectedInstance.x}, y: ${selectedInstance.y}`}
        />
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
                <ComponentIcon iconId={icon.id as IconId} color={selectedInstance.props.iconColor} size={16} />
              </button>
            ))}
          </div>
        </div>
        <label className="field color-field">
          <span>Icon color</span>
          <span className="color-control">
            <span
              aria-hidden="true"
              className="color-preview"
              data-testid="icon-color-preview"
              style={{ backgroundColor: selectedInstance.props.iconColor, height: "12px" }}
            />
            <input
              className="color-input"
              type="color"
              value={selectedInstance.props.iconColor}
              onChange={(event) =>
                onUpdateInstanceProps(selectedInstance.id, {
                  ...selectedInstance.props,
                  iconColor: event.target.value,
                })
              }
              aria-label="Icon color"
            />
          </span>
        </label>
        <label className="field color-field">
          <span>Corner color</span>
          <span className="color-control">
            <span
              aria-hidden="true"
              className="color-preview"
              data-testid="corner-color-preview"
              style={{ backgroundColor: selectedInstance.props.cornerColor, height: "12px" }}
            />
            <input
              className="color-input"
              type="color"
              value={selectedInstance.props.cornerColor}
              onChange={(event) =>
                onUpdateInstanceProps(selectedInstance.id, {
                  ...selectedInstance.props,
                  cornerColor: event.target.value,
                })
              }
              aria-label="Corner color"
            />
          </span>
        </label>
      </div>
    );
  }

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
                onStartComponentDrag(definition.type satisfies ComponentType);
              }}
              preview={renderIcon(definition.defaultProps)}
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
            instances.map((instance) => {
              const displayName = getInstanceDisplayName(instance);

              return (
                <ComponentListItem
                  key={instance.id}
                  testId={`layer-item-${instance.id}`}
                  preview={renderIcon(instance.props)}
                  title={displayName}
                  meta={`x: ${instance.x}, y: ${instance.y}`}
                  actions={
                    <>
                      <button
                        className="component-row-icon-button"
                        type="button"
                        onClick={() => onSelectInstance(instance.id)}
                        aria-label={`Edit ${displayName}`}
                      >
                        <Pencil
                          size={ACTION_ICON_SIZE}
                          strokeWidth={ICON_STROKE_WIDTH}
                          aria-hidden="true"
                          focusable="false"
                        />
                      </button>
                      <button
                        className="component-row-icon-button"
                        type="button"
                        onClick={() => onDeleteInstance(instance.id)}
                        aria-label={`Delete ${displayName}`}
                      >
                        <Trash2
                          size={ACTION_ICON_SIZE}
                          strokeWidth={ICON_STROKE_WIDTH}
                          aria-hidden="true"
                          focusable="false"
                        />
                      </button>
                    </>
                  }
                />
              );
            })
          ) : (
            <p className="empty-state">No components on canvas.</p>
          )}
        </div>
      </section>
    </div>
  );
};
