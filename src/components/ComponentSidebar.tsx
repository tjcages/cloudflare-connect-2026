import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { ComponentIcon } from "./ComponentIcon";
import { COMPONENT_REGISTRY, getComponentDefinition, getInstanceLayerSubtitle } from "./componentRegistry";
import { ComponentListItem } from "./ComponentListItem";
import { ICON_OPTIONS } from "./iconRegistry";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH } from "./iconTokens";
import type { ComponentInstance, ComponentType, IconBoxProps, IconId } from "../grid/types";
import { PALETTE_THEMES, type PaletteThemeId, paletteBrush } from "../theme/palette";

type PaletteThemePickerProps = {
  ariaLabel: string;
  value: PaletteThemeId;
  onChange: (id: PaletteThemeId) => void;
};

const PaletteThemePicker = ({ ariaLabel, value, onChange }: PaletteThemePickerProps) => (
  <div className="palette-theme-picker" role="radiogroup" aria-label={ariaLabel}>
    {PALETTE_THEMES.map((theme) => {
      const selected = value === theme.id;
      return (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={theme.label}
          className="palette-theme-swatch"
          style={{
            borderColor: selected ? theme.fillHex : "#f3f3f3",
            ["--palette-fill-fallback" as string]: theme.fillHex,
            ["--palette-fill-p3" as string]: theme.fillDisplayP3,
          }}
          onClick={() => onChange(theme.id)}
        >
          <span className="palette-theme-swatch-fill" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

type ComponentSidebarProps = {
  instances: ComponentInstance[];
  selectedInstance: ComponentInstance | null;
  onSelectInstance: (id: string) => void;
  onBack: () => void;
  onDeleteInstance: (id: string) => void;
  onUpdateInstanceProps: (id: string, props: IconBoxProps) => void;
  onStartComponentDrag: (type: ComponentType, pointer?: { clientX: number; clientY: number }) => void;
};

const componentTypes = Object.values(COMPONENT_REGISTRY);
const getInstanceDisplayName = (instance: ComponentInstance) => getComponentDefinition(instance.type).label;
const renderIcon = (props: IconBoxProps) => (
  <ComponentIcon iconId={props.iconId} color={paletteBrush(props.theme).iconFillHex} size={16} />
);

const getLayerActionLabel = (verb: string, displayName: string, subtitle: string | undefined) =>
  subtitle ? `${verb} ${displayName}, ${subtitle}` : `${verb} ${displayName}`;

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
    const palette = paletteBrush(selectedInstance.props.theme);

    return (
      <div className="component-config-panel">
        <div className="component-config-top-bar">
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
            Back
          </button>
          <span
            className="component-position"
            role="status"
            aria-label={`Position x ${selectedInstance.x}, y ${selectedInstance.y}`}
          >{`x: ${selectedInstance.x}, y: ${selectedInstance.y}`}</span>
        </div>
        <ComponentListItem
          className="component-config-header"
          testId="component-config-header"
          preview={renderIcon(selectedInstance.props)}
          title={displayName}
        />
        <div className="field">
          <span>Theme</span>
          <PaletteThemePicker
            ariaLabel="Theme"
            value={selectedInstance.props.theme}
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
                <ComponentIcon iconId={icon.id as IconId} color={palette.iconFillHex} size={16} />
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
                onStartComponentDrag(definition.type satisfies ComponentType, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
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
              const layerSubtitle = getInstanceLayerSubtitle(instance);

              return (
                <ComponentListItem
                  key={instance.id}
                  testId={`layer-item-${instance.id}`}
                  preview={renderIcon(instance.props)}
                  title={displayName}
                  meta={layerSubtitle}
                  actions={
                    <>
                      <button
                        className="component-row-icon-button"
                        type="button"
                        onClick={() => onSelectInstance(instance.id)}
                        aria-label={getLayerActionLabel("Edit", displayName, layerSubtitle)}
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
                        aria-label={getLayerActionLabel("Delete", displayName, layerSubtitle)}
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
