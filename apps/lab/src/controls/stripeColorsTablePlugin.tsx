import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { StripeColorsTable } from "./StripeColorsTable";
import type { EditableStripe } from "./stripeAdapter";

const { Row } = Components;

export type StripeColorsTableHandlers = {
  onColorChange: (id: string, hex: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export type StripeColorsTableRuntime = {
  stripes: readonly EditableStripe[];
  disabled: boolean;
  handlers: StripeColorsTableHandlers;
};

export const stripeColorsTableRuntime: StripeColorsTableRuntime = {
  stripes: [],
  disabled: false,
  handlers: {
    onColorChange: () => {},
    onThresholdChange: () => {},
    onWidthChange: () => {},
    onColorReorder: () => {},
    onAdd: () => {},
    onRemove: () => {},
  },
};

type StripeColorsTableSettings = Record<string, never>;

type StripeColorsTableInput = {
  value: string;
};

type StripeColorsTablePluginProps = LevaInputProps<string, StripeColorsTableSettings>;

export function stripeSyncKey(stripes: readonly EditableStripe[]): string {
  return stripes.map((s) => `${s.hex}:${s.startFrom}:${s.width}`).join("|");
}

function StripeColorsTablePluginComponent() {
  useInputContext<StripeColorsTablePluginProps>();
  const { stripes, disabled, handlers } = stripeColorsTableRuntime;

  return (
    <Row>
      <div className="w-full min-w-0">
        <StripeColorsTable
          stripes={stripes}
          disabled={disabled}
          onColorChange={handlers.onColorChange}
          onThresholdChange={handlers.onThresholdChange}
          onWidthChange={handlers.onWidthChange}
          onColorReorder={handlers.onColorReorder}
          onAdd={handlers.onAdd}
          onRemove={handlers.onRemove}
        />
      </div>
    </Row>
  );
}

export const stripeColorsTablePlugin = createPlugin<StripeColorsTableInput, string, StripeColorsTableSettings>({
  component: StripeColorsTablePluginComponent,
  normalize: (input) => ({
    value: input.value,
    settings: {},
  }),
  sanitize: (value) => String(value),
});
