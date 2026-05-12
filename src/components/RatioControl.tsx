type RatioControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export const RatioControl = ({ label, value, onChange }: RatioControlProps) => (
  <label className="field">
    <span>{label}</span>
    <div className="ratio-row">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  </label>
);
