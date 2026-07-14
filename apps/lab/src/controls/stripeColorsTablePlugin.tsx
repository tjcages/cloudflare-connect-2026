import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { StripeColorsTable } from "./StripeColorsTable";
import type { EditableStripe } from "./stripeAdapter";

const { Row } = Components;

export type StripeColorsTableHandlers = {
  onPaletteChange: (palette: string) => void;
  onRampEasingChange: (easing: string) => void;
  onThresholdEasingChange: (easing: string) => void;
  onShufflePalette: () => void;
  onUndoShuffle: () => void;
  onReverseColorOrder: () => void;
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
  paletteOptions: readonly string[];
  paletteValue: string;
  rampEasingOptions: Readonly<Record<string, string>>;
  rampEasingValue: string;
  showRampEasing: boolean;
  thresholdEasingOptions: Readonly<Record<string, string>>;
  thresholdEasingValue: string;
  canUndoShuffle: boolean;
  handlers: StripeColorsTableHandlers;
};

export const stripeColorsTableRuntime: StripeColorsTableRuntime = {
  stripes: [],
  disabled: false,
  paletteOptions: [],
  paletteValue: "",
  rampEasingOptions: {},
  rampEasingValue: "",
  showRampEasing: false,
  thresholdEasingOptions: {},
  thresholdEasingValue: "",
  canUndoShuffle: false,
  handlers: {
    onPaletteChange: () => {},
    onRampEasingChange: () => {},
    onThresholdEasingChange: () => {},
    onShufflePalette: () => {},
    onUndoShuffle: () => {},
    onReverseColorOrder: () => {},
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
          paletteOptions={stripeColorsTableRuntime.paletteOptions}
          paletteValue={stripeColorsTableRuntime.paletteValue}
          rampEasingOptions={stripeColorsTableRuntime.rampEasingOptions}
          rampEasingValue={stripeColorsTableRuntime.rampEasingValue}
          showRampEasing={stripeColorsTableRuntime.showRampEasing}
          thresholdEasingOptions={stripeColorsTableRuntime.thresholdEasingOptions}
          thresholdEasingValue={stripeColorsTableRuntime.thresholdEasingValue}
          canUndoShuffle={stripeColorsTableRuntime.canUndoShuffle}
          onPaletteChange={handlers.onPaletteChange}
          onRampEasingChange={handlers.onRampEasingChange}
          onThresholdEasingChange={handlers.onThresholdEasingChange}
          onShufflePalette={handlers.onShufflePalette}
          onUndoShuffle={handlers.onUndoShuffle}
          onReverseColorOrder={handlers.onReverseColorOrder}
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
