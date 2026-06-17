import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { StripeColorsTable } from "./StripeColorsTable";
import type { Stripe } from "@necatikcl/stripes-shader";

const { Row } = Components;

export type StripeColorsTableHandlers = {
  onColorChange: (id: string, hex: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
};

export type StripeColorsTableRuntime = {
  stripes: readonly Stripe[];
  disabled: boolean;
  handlers: StripeColorsTableHandlers;
};

/** Leva plugin settings cannot carry refs/functions; sync via this runtime before each render. */
export const stripeColorsTableRuntime: StripeColorsTableRuntime = {
  stripes: [],
  disabled: false,
  handlers: {
    onColorChange: () => {},
    onThresholdChange: () => {},
    onWidthChange: () => {},
  },
};

type StripeColorsTableSettings = Record<string, never>;

type StripeColorsTableInput = {
  value: string;
};

type StripeColorsTableProps = LevaInputProps<string, StripeColorsTableSettings>;

export function stripeSyncKey(stripes: readonly Stripe[]): string {
  return stripes.map((stripe) => `${stripe.hex}:${stripe.startFrom}:${stripe.width}`).join("|");
}

function StripeColorsTablePluginComponent() {
  useInputContext<StripeColorsTableProps>();
  const { stripes, disabled, handlers } = stripeColorsTableRuntime;

  return (
    <Row>
      <div className="playground-stripe-colors-leva-row w-full min-w-0">
        <StripeColorsTable
          stripes={stripes}
          disabled={disabled}
          onColorChange={handlers.onColorChange}
          onThresholdChange={handlers.onThresholdChange}
          onWidthChange={handlers.onWidthChange}
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
