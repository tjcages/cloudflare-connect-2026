import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { StripeColorsTable } from "./StripeColorsTable";
import type { EditableStripe } from "./stripeAdapter";

const { Row } = Components;

export type StripeColorsTableHandlers = {
  onRampEasingChange: (easing: string) => void;
  onThresholdEasingChange: (easing: string) => void;
  onShufflePalette: () => void;
  onUndoShuffle: () => void;
  onReverseColorOrder: () => void;
  onSavePalette: () => void;
  onColorChange: (id: string, hex: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export type StripeColorsTableRuntime = {
  stripes: readonly EditableStripe[];
  disabled: boolean;
  rampEasingOptions: Readonly<Record<string, string>>;
  rampEasingValue: string;
  showRampEasing: boolean;
  showColorControls: boolean;
  showSavePalette: boolean;
  thresholdEasingOptions: Readonly<Record<string, string>>;
  thresholdEasingValue: string;
  canUndoShuffle: boolean;
  handlers: StripeColorsTableHandlers;
};

export const stripeColorsTableRuntime: StripeColorsTableRuntime = {
  stripes: [],
  disabled: false,
  rampEasingOptions: {},
  rampEasingValue: "",
  showRampEasing: false,
  showColorControls: true,
  showSavePalette: false,
  thresholdEasingOptions: {},
  thresholdEasingValue: "",
  canUndoShuffle: false,
  handlers: {
    onRampEasingChange: () => {},
    onThresholdEasingChange: () => {},
    onShufflePalette: () => {},
    onUndoShuffle: () => {},
    onReverseColorOrder: () => {},
    onSavePalette: () => {},
    onColorChange: () => {},
    onOpacityChange: () => {},
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
  render?: (get: (path: string) => unknown) => boolean;
};

type StripeColorsTablePluginProps = LevaInputProps<string, StripeColorsTableSettings>;

export function stripeSyncKey(stripes: readonly EditableStripe[]): string {
  return stripes.map((s) => `${s.hex}:${s.startFrom}:${s.width}:${s.opacity}`).join("|");
}

function StripeColorsTablePluginComponent() {
  useInputContext<StripeColorsTablePluginProps>();
  const { stripes, disabled, handlers } = stripeColorsTableRuntime;

  return (
    <Row>
      <div className="playground-stripe-colors-leva-row w-full min-w-0">
        <StripeColorsTable
          stripes={stripes}
          disabled={disabled}
          rampEasingOptions={stripeColorsTableRuntime.rampEasingOptions}
          rampEasingValue={stripeColorsTableRuntime.rampEasingValue}
          showRampEasing={stripeColorsTableRuntime.showRampEasing}
          showColorControls={stripeColorsTableRuntime.showColorControls}
          showSavePalette={stripeColorsTableRuntime.showSavePalette}
          thresholdEasingOptions={stripeColorsTableRuntime.thresholdEasingOptions}
          thresholdEasingValue={stripeColorsTableRuntime.thresholdEasingValue}
          canUndoShuffle={stripeColorsTableRuntime.canUndoShuffle}
          onRampEasingChange={handlers.onRampEasingChange}
          onThresholdEasingChange={handlers.onThresholdEasingChange}
          onShufflePalette={handlers.onShufflePalette}
          onUndoShuffle={handlers.onUndoShuffle}
          onReverseColorOrder={handlers.onReverseColorOrder}
          onSavePalette={handlers.onSavePalette}
          onColorChange={handlers.onColorChange}
          onOpacityChange={handlers.onOpacityChange}
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
