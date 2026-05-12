import { GapMaskEditor } from "./GapMaskEditor";
import { RatioControl } from "./RatioControl";
import { BASE_UNIT, type GapMask, type GridConfig } from "../grid/types";

type SidebarProps = {
  config: GridConfig;
  cellCount: number;
  logicalSize: {
    width: number;
    height: number;
  };
  renderSize: {
    width: number;
    height: number;
  };
  onConfigChange: (config: GridConfig) => void;
  onSmallRatioChange: (value: number) => void;
  onLargeRatioChange: (value: number) => void;
  onGenerate: () => void;
  onGapMaskChange: (mask: GapMask) => void;
  onCopySvg: () => void;
  copyState: "idle" | "copied" | "failed";
};

export const Sidebar = ({
  config,
  cellCount,
  logicalSize,
  renderSize,
  onConfigChange,
  onSmallRatioChange,
  onLargeRatioChange,
  onGenerate,
  onGapMaskChange,
  onCopySvg,
  copyState,
}: SidebarProps) => (
  <aside className="sidebar">
    <label className="field">
      <span>Seed</span>
      <input
        type="text"
        value={config.seed}
        onChange={(event) => onConfigChange({ ...config, seed: event.target.value })}
      />
    </label>

    <div className="field-grid">
      <label className="field">
        <span>Width</span>
        <input
          type="number"
          min={BASE_UNIT}
          step={BASE_UNIT}
          value={config.width}
          onChange={(event) => onConfigChange({ ...config, width: Number(event.target.value) })}
        />
      </label>
      <label className="field">
        <span>Height</span>
        <input
          type="number"
          min={BASE_UNIT}
          step={BASE_UNIT}
          value={config.height}
          onChange={(event) => onConfigChange({ ...config, height: Number(event.target.value) })}
        />
      </label>
    </div>

    <RatioControl
      label="Density"
      value={config.density}
      onChange={(density) => onConfigChange({ ...config, density })}
    />
    <RatioControl label="40x40 cell ratio" value={config.smallCellRatio} onChange={onSmallRatioChange} />
    <RatioControl label="80x80 cell ratio" value={config.largeCellRatio} onChange={onLargeRatioChange} />

    <button className="generate-button" type="button" onClick={onGenerate}>
      Generate
    </button>

    <GapMaskEditor mask={config.gapMask} onChange={onGapMaskChange} />

    <button className="export-button" type="button" onClick={onCopySvg}>
      {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy as SVG"}
    </button>

    <dl className="stats">
      <div>
        <dt>Logical</dt>
        <dd>
          {logicalSize.width} x {logicalSize.height}
        </dd>
      </div>
      <div>
        <dt>Rendered</dt>
        <dd>
          {renderSize.width} x {renderSize.height}
        </dd>
      </div>
      <div>
        <dt>Cells</dt>
        <dd>{cellCount}</dd>
      </div>
    </dl>
  </aside>
);
