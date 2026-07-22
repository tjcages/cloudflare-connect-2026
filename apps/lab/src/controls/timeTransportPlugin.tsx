import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { TimeTransport, type TimeTransportController } from "../components/TimeTransport";

const { Label, Row } = Components;

type TimeTransportInput = {
  value?: string;
  label?: string;
  controller: TimeTransportController;
};

type TimeTransportSettings = { controller: TimeTransportController };
type TimeTransportProps = LevaInputProps<string, TimeTransportSettings>;

function TimeTransportPluginComponent() {
  const { label, settings } = useInputContext<TimeTransportProps>();
  return (
    <Row input>
      <Label>{label}</Label>
      <TimeTransport controller={settings.controller} />
    </Row>
  );
}

export const timeTransportPlugin = createPlugin<TimeTransportInput, string, TimeTransportSettings>({
  component: TimeTransportPluginComponent,
  normalize: (input) => ({
    value: input.value ?? "transport",
    settings: { controller: input.controller },
  }),
  sanitize: (value) => value,
});
