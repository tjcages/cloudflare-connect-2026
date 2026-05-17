import { Undo2 } from "lucide-react";
import { DEFAULT_CONFIG } from "../grid/config";
import { BASE_UNIT, type GapMask, type GridConfig } from "../grid/types";
import { ConfigSeparator } from "./ConfigSeparator";
import { GapMaskEditor } from "./GapMaskEditor";
import { RatioControl } from "./RatioControl";
import { Button } from "./Button";
import { BuilderField } from "./BuilderField";
import { BuilderFieldHeaderRow } from "./BuilderFieldHeaderRow";
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
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <BuilderField as="label" htmlFor="seed-input">
        <span>Seed</span>
        <input
          id="seed-input"
          className="builder-field-control"
          type="text"
          value={config.seed}
          onChange={(event) => onConfigChange({ ...config, seed: event.target.value })}
        />
      </BuilderField>

      <div className="grid grid-cols-2 gap-3.5">
        <BuilderField as="label" htmlFor="width-input">
          <span>Width</span>
          <input
            id="width-input"
            className="builder-field-control"
            type="number"
            min={BASE_UNIT}
            step={BASE_UNIT}
            value={config.width}
            onChange={(event) => onConfigChange({ ...config, width: Number(event.target.value) })}
          />
        </BuilderField>
        <BuilderField as="label" htmlFor="height-input">
          <span>Height</span>
          <input
            id="height-input"
            className="builder-field-control"
            type="number"
            min={BASE_UNIT}
            step={BASE_UNIT}
            value={config.height}
            onChange={(event) => onConfigChange({ ...config, height: Number(event.target.value) })}
          />
        </BuilderField>
      </div>

      <RatioControl
        label="Density"
        value={config.density}
        onChange={(density) => onConfigChange({ ...config, density })}
      />
      <RatioControl label="40x40 cell ratio" value={config.smallCellRatio} onChange={onSmallRatioChange} />
      <RatioControl label="80x80 cell ratio" value={config.largeCellRatio} onChange={onLargeRatioChange} />

      <BuilderField colorField>
        <BuilderFieldHeaderRow>
          <label htmlFor="stroke-color-input">Stroke color</label>
          <div className="grid size-[calc(4em/3)] shrink-0 place-items-center">
            {!strokeIsDefault ? (
              <button
                type="button"
                data-slot="field-reset"
                className="grid size-full min-h-0 min-w-0 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-inherit [&>svg]:size-[1em]"
                data-testid="stroke-color-reset"
                onClick={() => onStrokeColorChange(DEFAULT_CONFIG.strokeColor)}
              >
                <Undo2 size={ACTION_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />
              </button>
            ) : null}
          </div>
        </BuilderFieldHeaderRow>
        <span className="relative flex min-h-8 w-full cursor-pointer items-center rounded-md border border-builder-hairline bg-white px-2">
          <span
            className="block h-0.5 w-full"
            data-testid="stroke-color-preview"
            style={{ backgroundColor: config.strokeColor, height: "2px" }}
          />
          <input
            id="stroke-color-input"
            className="absolute inset-0 cursor-pointer opacity-0"
            type="color"
            value={config.strokeColor}
            onChange={(event) => onStrokeColorChange(event.target.value)}
          />
        </span>
      </BuilderField>

      <GapMaskEditor mask={config.gapMask} onChange={onGapMaskChange} />

      <ConfigSeparator />

      <Button variant="default" padding="square" onClick={onGenerate}>
        Generate
      </Button>

      <Button variant="default" padding="inline" className="mt-auto" onClick={onCopyPng}>
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy PNG"}
      </Button>

      <dl className="m-0 grid gap-0">
        <div className="flex justify-between pt-0">
          <dt className="text-[10px] font-normal uppercase text-builder-subtle">Logical</dt>
          <dd className="m-0 text-[11px] font-normal text-builder-control">
            {logicalSize.width} x {logicalSize.height}
          </dd>
        </div>
        <div className="flex justify-between border-t border-builder-hairline pt-2">
          <dt className="text-[10px] font-normal uppercase text-builder-subtle">Rendered</dt>
          <dd className="m-0 text-[11px] font-normal text-builder-control">
            {renderSize.width} x {renderSize.height}
          </dd>
        </div>
        <div className="flex justify-between border-t border-builder-hairline pt-2">
          <dt className="text-[10px] font-normal uppercase text-builder-subtle">Cells</dt>
          <dd className="m-0 text-[11px] font-normal text-builder-control">{cellCount}</dd>
        </div>
      </dl>
    </div>
  );
};
