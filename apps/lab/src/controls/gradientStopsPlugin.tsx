import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { useSyncExternalStore } from "react";
import { GradientStopsEditor, type GradientStopsEditorLayout } from "./GradientStopsEditor";
import {
  parseTwizzlerGradientStops,
  serializeTwizzlerGradientStops,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";

const { Row } = Components;

type GradientStopsSettings = {
  colorFar: string;
  colorNear: string;
};

type GradientStopsInput = {
  value: string;
  colorFar?: string;
  colorNear?: string;
  render?: (get: (path: string) => unknown) => boolean;
};

type GradientStopsPluginProps = LevaInputProps<string, GradientStopsSettings>;

let editorLayout: GradientStopsEditorLayout = "field";
const layoutListeners = new Set<() => void>();

export function setTwizzlerGradientEditorLayout(layout: GradientStopsEditorLayout): void {
  if (layout === editorLayout) return;
  editorLayout = layout;
  for (const listener of layoutListeners) listener();
}

function subscribeTwizzlerGradientEditorLayout(listener: () => void): () => void {
  layoutListeners.add(listener);
  return () => {
    layoutListeners.delete(listener);
  };
}

function GradientStopsPluginComponent() {
  const { value, onUpdate, disabled, settings } = useInputContext<GradientStopsPluginProps>();
  const layout = useSyncExternalStore(
    subscribeTwizzlerGradientEditorLayout,
    () => editorLayout,
    () => editorLayout,
  );
  const stops = parseTwizzlerGradientStops(value, settings.colorFar, settings.colorNear);

  return (
    <Row>
      <div className="twizzler-gradient-leva-row w-full min-w-0">
        <GradientStopsEditor
          layout={layout}
          stops={stops}
          disabled={disabled}
          onChange={(next: TwizzlerGradientStop[]) => onUpdate(serializeTwizzlerGradientStops(next))}
        />
      </div>
    </Row>
  );
}

export const gradientStopsPlugin = createPlugin<GradientStopsInput, string, GradientStopsSettings>({
  component: GradientStopsPluginComponent,
  normalize: (input) => {
    const record = input && typeof input === "object" ? input : null;
    const colorFar = record && typeof record.colorFar === "string" ? record.colorFar : "#fea700";
    const colorNear = record && typeof record.colorNear === "string" ? record.colorNear : "#f46021";
    const raw = record && "value" in record ? record.value : input;
    return {
      value: serializeTwizzlerGradientStops(parseTwizzlerGradientStops(raw, colorFar, colorNear)),
      settings: { colorFar, colorNear },
    };
  },
  sanitize: (value) => serializeTwizzlerGradientStops(parseTwizzlerGradientStops(value, "#fea700", "#f46021")),
});
