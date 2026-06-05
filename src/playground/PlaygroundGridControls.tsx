import { HexColorPopover } from "../components/HexColorPopover";
import { ControlValueInput } from "./ControlValueInput";
import { PlaygroundControlSection } from "./PlaygroundControlSection";
import {
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  PLAYGROUND_CELL_SIZE_MAX,
  PLAYGROUND_CELL_SIZE_MIN,
  PLAYGROUND_LETTER_SIZE_MAX,
  PLAYGROUND_LETTER_SIZE_MIN,
  type PlaygroundGridConfig,
  type StripeOrientation,
} from "./playgroundGridConfig";

type GridControlsProps = {
  config: PlaygroundGridConfig;
  onChange: (patch: Partial<PlaygroundGridConfig>) => void;
  onResetGrid: () => void;
  onResetLetters: () => void;
  onResetAnimation: () => void;
  gridModified: boolean;
  lettersModified: boolean;
  animationModified: boolean;
  disabled: boolean;
};

type NumberFieldProps = {
  label: string;
  value: number;
  inputMin: number;
  inputMax: number;
  sliderMin: number;
  sliderMax: number;
  step: number;
  ariaLabel: string;
  disabled: boolean;
  onChange: (value: number) => void;
  formatDisplay?: (value: number) => string;
};

function NumberField({
  label,
  value,
  inputMin,
  inputMax,
  sliderMin,
  sliderMax,
  step,
  ariaLabel,
  disabled,
  onChange,
  formatDisplay,
}: NumberFieldProps) {
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, value));
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between gap-2 text-neutral-600">
        <span>{label}</span>
        <ControlValueInput
          value={value}
          inputMin={inputMin}
          inputMax={inputMax}
          commitMin={inputMin}
          commitMax={inputMax}
          disabled={disabled}
          onChange={onChange}
          formatDisplay={formatDisplay}
          ariaLabel={ariaLabel}
        />
      </span>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-neutral-700 disabled:cursor-not-allowed"
        aria-label={`${ariaLabel} slider`}
      />
    </label>
  );
}

function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string): number {
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : DEFAULT_PLAYGROUND_GRID_CONFIG.letterColor;
}

export function PlaygroundGridControls({
  config,
  onChange,
  onResetGrid,
  onResetLetters,
  onResetAnimation,
  gridModified,
  lettersModified,
  animationModified,
  disabled,
}: GridControlsProps) {
  const acrossMax = Math.max(config.cellWidth, config.cellHeight);
  return (
    <>
      <PlaygroundControlSection
        title="Grid"
        defaultOpen
        testId="playground-section-grid"
        modified={gridModified}
        onReset={onResetGrid}
      >
        <NumberField
          label="Cell width"
          value={config.cellWidth}
          inputMin={PLAYGROUND_CELL_SIZE_MIN}
          inputMax={PLAYGROUND_CELL_SIZE_MAX}
          sliderMin={1}
          sliderMax={24}
          step={1}
          ariaLabel="Cell width in px"
          disabled={disabled}
          onChange={(value) => onChange({ cellWidth: value })}
        />
        <NumberField
          label="Cell height"
          value={config.cellHeight}
          inputMin={PLAYGROUND_CELL_SIZE_MIN}
          inputMax={PLAYGROUND_CELL_SIZE_MAX}
          sliderMin={1}
          sliderMax={24}
          step={1}
          ariaLabel="Cell height in px"
          disabled={disabled}
          onChange={(value) => onChange({ cellHeight: value })}
        />
        <NumberField
          label="Gap X"
          value={config.gapX}
          inputMin={0}
          inputMax={config.cellWidth}
          sliderMin={0}
          sliderMax={config.cellWidth}
          step={0.5}
          ariaLabel="Horizontal gap between cells in px"
          disabled={disabled}
          onChange={(value) => onChange({ gapX: value })}
          formatDisplay={(v) => v.toFixed(1)}
        />
        <NumberField
          label="Gap Y"
          value={config.gapY}
          inputMin={0}
          inputMax={config.cellHeight}
          sliderMin={0}
          sliderMax={config.cellHeight}
          step={0.5}
          ariaLabel="Vertical gap between cells in px"
          disabled={disabled}
          onChange={(value) => onChange({ gapY: value })}
          formatDisplay={(v) => v.toFixed(1)}
        />
        <NumberField
          label="Corner radius"
          value={config.cornerRadius}
          inputMin={0}
          inputMax={PLAYGROUND_CELL_SIZE_MAX}
          sliderMin={0}
          sliderMax={acrossMax / 2}
          step={0.5}
          ariaLabel="Stripe corner radius in px"
          disabled={disabled}
          onChange={(value) => onChange({ cornerRadius: value })}
          formatDisplay={(v) => v.toFixed(1)}
        />
        <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
          <span className="text-neutral-600">Orientation</span>
          <select
            value={config.orientation}
            disabled={disabled}
            onChange={(event) => onChange({ orientation: event.target.value as StripeOrientation })}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed"
            aria-label="Stripe orientation"
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Letters"
        testId="playground-section-letters"
        modified={lettersModified}
        onReset={onResetLetters}
      >
        <NumberField
          label="Size"
          value={config.letterSize}
          inputMin={PLAYGROUND_LETTER_SIZE_MIN}
          inputMax={PLAYGROUND_LETTER_SIZE_MAX}
          sliderMin={2}
          sliderMax={24}
          step={1}
          ariaLabel="Letter font size in px"
          disabled={disabled}
          onChange={(value) => onChange({ letterSize: value })}
        />
        <NumberField
          label="Ratio"
          value={config.letterRatio}
          inputMin={0}
          inputMax={1}
          sliderMin={0}
          sliderMax={1}
          step={0.01}
          ariaLabel="Fraction of eligible cells with a letter"
          disabled={disabled}
          onChange={(value) => onChange({ letterRatio: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
          <span className="text-neutral-600">Charset</span>
          <input
            type="text"
            value={config.letterCharset}
            disabled={disabled}
            spellCheck={false}
            onChange={(event) => onChange({ letterCharset: event.target.value })}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs disabled:cursor-not-allowed"
            aria-label="Letter charset"
          />
        </label>
        <div className={`flex items-center justify-between gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
          <span className="text-neutral-600">Color</span>
          <HexColorPopover
            color={intToHex(config.letterColor)}
            disabled={disabled}
            onChange={(hex) => onChange({ letterColor: hexToInt(hex) })}
            ariaLabel="Letter color"
            align="right"
            triggerClassName="h-7 w-12 rounded border border-neutral-300"
            triggerStyle={{ backgroundColor: intToHex(config.letterColor) }}
          />
        </div>
        <NumberField
          label="Shuffle speed"
          value={config.letterShuffleSpeed}
          inputMin={0.05}
          inputMax={20}
          sliderMin={0.25}
          sliderMax={4}
          step={0.05}
          ariaLabel="Letter shuffle speed factor"
          disabled={disabled}
          onChange={(value) => onChange({ letterShuffleSpeed: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Animation ranges"
        testId="playground-section-animation-ranges"
        modified={animationModified}
        onReset={onResetAnimation}
      >
        <NumberField
          label="Gap period min"
          value={config.sparkleGapsPeriodMinSec}
          inputMin={0.01}
          inputMax={10}
          sliderMin={0.05}
          sliderMax={2}
          step={0.01}
          ariaLabel="Sparkle gap period minimum seconds"
          disabled={disabled}
          onChange={(value) => onChange({ sparkleGapsPeriodMinSec: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
          label="Gap period max"
          value={config.sparkleGapsPeriodMaxSec}
          inputMin={0.01}
          inputMax={10}
          sliderMin={0.05}
          sliderMax={2}
          step={0.01}
          ariaLabel="Sparkle gap period maximum seconds"
          disabled={disabled}
          onChange={(value) => onChange({ sparkleGapsPeriodMaxSec: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
          label="Width period min"
          value={config.sparkleWidthPeriodMinSec}
          inputMin={0.01}
          inputMax={10}
          sliderMin={0.05}
          sliderMax={2}
          step={0.01}
          ariaLabel="Width shuffle period minimum seconds"
          disabled={disabled}
          onChange={(value) => onChange({ sparkleWidthPeriodMinSec: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
          label="Width period max"
          value={config.sparkleWidthPeriodMaxSec}
          inputMin={0.01}
          inputMax={10}
          sliderMin={0.05}
          sliderMax={2}
          step={0.01}
          ariaLabel="Width shuffle period maximum seconds"
          disabled={disabled}
          onChange={(value) => onChange({ sparkleWidthPeriodMaxSec: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
          label="Width swing"
          value={config.widthShuffleSwing}
          inputMin={0}
          inputMax={32}
          sliderMin={0}
          sliderMax={8}
          step={0.05}
          ariaLabel="Width shuffle swing in px"
          disabled={disabled}
          onChange={(value) => onChange({ widthShuffleSwing: value })}
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
          label="Color smoothing"
          value={config.smoothingMaxStep}
          inputMin={0}
          inputMax={255}
          sliderMin={0}
          sliderMax={8}
          step={1}
          ariaLabel="Max stripe-index step per update (0 snaps)"
          disabled={disabled}
          onChange={(value) => onChange({ smoothingMaxStep: value })}
        />
        <NumberField
          label="Update interval"
          value={config.gridUpdateIntervalMs}
          inputMin={0}
          inputMax={1000}
          sliderMin={0}
          sliderMax={300}
          step={1}
          ariaLabel="Grid update interval in milliseconds"
          disabled={disabled}
          onChange={(value) => onChange({ gridUpdateIntervalMs: value })}
        />
      </PlaygroundControlSection>
    </>
  );
}
