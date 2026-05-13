import { COMPONENT_REGISTRY } from "./componentRegistry";
import { IconBoxPreview } from "./IconBoxPreview";
import type { ComponentInstance, ComponentType, IconBoxProps } from "../grid/types";

type ComponentSidebarProps = {
  instances: ComponentInstance[];
  selectedInstance: ComponentInstance | null;
  onSelectInstance: (id: string) => void;
  onBack: () => void;
  onDeleteInstance: (id: string) => void;
  onUpdateInstanceProps: (id: string, props: IconBoxProps) => void;
};

const componentTypes = Object.values(COMPONENT_REGISTRY);

export const ComponentSidebar = ({
  instances,
  selectedInstance,
  onSelectInstance,
  onBack,
  onDeleteInstance,
  onUpdateInstanceProps,
}: ComponentSidebarProps) => {
  if (selectedInstance) {
    return (
      <div className="component-config-panel">
        <button className="back-button" type="button" onClick={onBack}>
          Back
        </button>
        <div className="section-heading">
          <span>{selectedInstance.name}</span>
          <small>
            x: {selectedInstance.x}, y: {selectedInstance.y}
          </small>
        </div>
        <IconBoxPreview cornerColor={selectedInstance.props.cornerColor} />
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
          <span>Current instances</span>
          <small>{instances.length}</small>
        </div>
        <div className="component-scroll-region">
          {instances.length ? (
            instances.map((instance) => (
              <div className="component-row" key={instance.id}>
                <IconBoxPreview cornerColor={instance.props.cornerColor} size="small" />
                <span className="component-name">{instance.name}</span>
                <span className="component-position">
                  x: {instance.x}, y: {instance.y}
                </span>
                <button type="button" onClick={() => onSelectInstance(instance.id)} aria-label={`Edit ${instance.name}`}>
                  Edit
                </button>
                <button type="button" onClick={() => onDeleteInstance(instance.id)} aria-label={`Delete ${instance.name}`}>
                  Trash
                </button>
              </div>
            ))
          ) : (
            <p className="empty-state">No components on canvas.</p>
          )}
        </div>
      </section>

      <section className="component-section">
        <div className="section-heading">
          <span>Components</span>
        </div>
        <div className="component-scroll-region">
          {componentTypes.map((definition) => (
            <button
              key={definition.type}
              className="component-card"
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-component-type", definition.type satisfies ComponentType);
                event.dataTransfer.setData("text/plain", definition.type);
              }}
            >
              <IconBoxPreview cornerColor={definition.defaultProps.cornerColor} />
              <span>{definition.label}</span>
              <small>Drag to canvas</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
