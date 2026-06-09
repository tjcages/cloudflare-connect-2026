import { useCallback, useId, useState, type KeyboardEvent } from "react";

type PlaygroundCanvasSizeControlsProps = {
  sourceWidth: number;
  sourceHeight: number;
  applyDisplayScale: (multiplier: number) => void;
  disabled?: boolean;
};

export function PlaygroundCanvasSizeControls({
  sourceWidth,
  sourceHeight,
  applyDisplayScale,
  disabled = false,
}: PlaygroundCanvasSizeControlsProps) {
  const scaleId = useId();
  const [customScaleInput, setCustomScaleInput] = useState("");
  const scaleDisabled = disabled || sourceWidth <= 0 || sourceHeight <= 0;

  const commitCustomScale = useCallback(() => {
    const trimmed = customScaleInput.trim();
    if (trimmed === "") {
      return;
    }
    const multiplier = Number(trimmed);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return;
    }
    applyDisplayScale(multiplier);
  }, [applyDisplayScale, customScaleInput]);

  const onCustomScaleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitCustomScale();
      event.currentTarget.blur();
    }
  };

  return (
    <section className="playground-canvas-size-controls" data-testid="playground-canvas-size-controls">
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">Presets</span>
        </div>
        <div>
          <div className="playground-canvas-scale-controls">
            <div className="playground-canvas-scale-buttons">
              <button type="button" disabled={scaleDisabled} onClick={() => applyDisplayScale(1)}>
                1x
              </button>
              <button type="button" disabled={scaleDisabled} onClick={() => applyDisplayScale(2)}>
                2x
              </button>
            </div>
            <div className="playground-canvas-scale-input-group">
              <div>
                <input
                  id={scaleId}
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={customScaleInput}
                  disabled={scaleDisabled}
                  placeholder="4"
                  aria-label="Custom canvas scale multiplier"
                  onChange={(event) => setCustomScaleInput(event.target.value)}
                  onBlur={commitCustomScale}
                  onKeyDown={onCustomScaleKeyDown}
                />
              </div>
              <span className="playground-canvas-scale-suffix">x</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
