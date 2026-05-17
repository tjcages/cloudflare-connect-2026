import { BuilderField } from "./BuilderField";

type RatioControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export const RatioControl = ({ label, value, onChange }: RatioControlProps) => (
  <BuilderField as="label">
    <span>{label}</span>
    <div className="grid grid-cols-[1fr_56px] items-center gap-3.5">
      <input
        className="min-w-0"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        className="builder-field-control"
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  </BuilderField>
);
