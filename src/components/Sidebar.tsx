import { Undo2 } from "lucide-react";
import { DEFAULT_CONFIG } from "../grid/config";
import { BASE_UNIT, type GapMask, type GridConfig } from "../grid/types";
import { GapMaskEditor } from "./GapMaskEditor";
import { RatioControl } from "./RatioControl";
import { ACTION_ICON_SIZE, ICON_STROKE_WIDTH } from "./iconTokens";

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
  onStrokeColorChange: (color: string) => void;
  onGenerate: () => void;
  onGapMaskChange: (mask: GapMask) => void;
  onCopyPng: () => void;
  copyState: "idle" | "copied" | "failed";
};

const defaultStrokeHex = DEFAULT_CONFIG.strokeColor.trim().toLowerCase();

export const Sidebar = ({
  config,
  cellCount,
  logicalSize,
  renderSize,
  onConfigChange,
  onSmallRatioChange,
  onLargeRatioChange,
  onStrokeColorChange,
  onGenerate,
  onGapMaskChange,
  onCopyPng,
  copyState,
}: SidebarProps) => {
  const strokeIsDefault = config.strokeColor.trim().toLowerCase() === defaultStrokeHex;

  return (
    <div className="grid-sidebar">
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

      <div className="field color-field">
        <div className="field-label-row">
          <label htmlFor="stroke-color-input">Stroke color</label>
          <button
            type="button"
            className="field-reset-button"
            disabled={strokeIsDefault}
            aria-label="Reset stroke color to default"
            onClick={() => onStrokeColorChange(DEFAULT_CONFIG.strokeColor)}
          >
            <Undo2 size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <span className="color-control">
          <span
            aria-hidden="true"
            className="color-preview"
            data-testid="stroke-color-preview"
            style={{ backgroundColor: config.strokeColor, height: "2px" }}
          />
          <input
            id="stroke-color-input"
            className="color-input"
            type="color"
            value={config.strokeColor}
            onChange={(event) => onStrokeColorChange(event.target.value)}
          />
        </span>
      </div>

      <button className="generate-button" type="button" onClick={onGenerate}>
        Generate
      </button>

      <GapMaskEditor mask={config.gapMask} onChange={onGapMaskChange} />

      <button className="export-button" type="button" onClick={onCopyPng}>
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy PNG"}
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
    </div>
  );
};
