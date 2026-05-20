import { useEffect, useId, useRef, useState } from "react";
import type { FocusEventHandler, ChangeEventHandler } from "react";
import type { IconBoxDirection } from "../grid/types";
import { BuilderField } from "./BuilderField";
import { BuilderSelectField } from "./BuilderSelectField";
import { cn } from "../lib/cn";

export const ICON_BOX_LENGTH_MIN = 1;
export const ICON_BOX_LENGTH_MAX = 10;

const clampIconBoxLength = (value: number): number =>
  Math.min(ICON_BOX_LENGTH_MAX, Math.max(ICON_BOX_LENGTH_MIN, Math.floor(value)));

const previewLengthFromDraft = (draft: string): number => {
  const trimmed = draft.trim();
  if (trimmed === "" || trimmed === "-") {
    return ICON_BOX_LENGTH_MIN;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return ICON_BOX_LENGTH_MIN;
  }
  return clampIconBoxLength(parsed);
};

const isCommittedDraft = (draft: string): boolean => {
  const trimmed = draft.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= ICON_BOX_LENGTH_MIN && parsed <= ICON_BOX_LENGTH_MAX;
};

type IconBoxLayoutFieldsProps = {
  instanceId: string;
  length: number | undefined;
  direction: IconBoxDirection | undefined;
  onLengthChange: (length: number) => void;
  onDirectionChange: (direction: IconBoxDirection) => void;
};

export const IconBoxLayoutFields = ({
  instanceId,
  length,
  direction,
  onLengthChange,
  onDirectionChange,
}: IconBoxLayoutFieldsProps) => {
  const lengthInputId = useId();
  const directionSelectId = useId();
  const committedLength = length ?? ICON_BOX_LENGTH_MIN;
  const committedDirection = direction ?? "horizontal";
  const directionDisabled = committedLength <= ICON_BOX_LENGTH_MIN;

  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const liveLengthRef = useRef(committedLength);
  const lengthFocused = lengthDraft !== null;
  const draft = lengthDraft ?? String(committedLength);
  const ghostLength = previewLengthFromDraft(draft);
  const showLengthGhost = lengthFocused && !isCommittedDraft(draft);

  useEffect(() => {
    setLengthDraft(null);
    liveLengthRef.current = committedLength;
  }, [instanceId, committedLength]);

  const onLengthFocus: FocusEventHandler<HTMLInputElement> = () => {
    liveLengthRef.current = committedLength;
    setLengthDraft(String(committedLength));
  };

  const onLengthChangeDraft: ChangeEventHandler<HTMLInputElement> = (event) => {
    const nextDraft = event.target.value;
    setLengthDraft(nextDraft);
    if (isCommittedDraft(nextDraft)) {
      const parsed = Number.parseInt(nextDraft.trim(), 10);
      if (parsed !== liveLengthRef.current) {
        liveLengthRef.current = parsed;
        onLengthChange(parsed);
      }
    }
  };

  const onLengthBlur: FocusEventHandler<HTMLInputElement> = () => {
    const next = previewLengthFromDraft(lengthDraft ?? String(committedLength));
    setLengthDraft(null);
    if (next !== liveLengthRef.current) {
      liveLengthRef.current = next;
      onLengthChange(next);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <BuilderField as="label" htmlFor={lengthInputId}>
        <span>Length</span>
        <div className="relative min-w-0">
          {showLengthGhost ? (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2",
                "text-[12px] text-builder-muted/35 tabular-nums",
              )}
            >
              {ghostLength}
            </span>
          ) : null}
          <input
            id={lengthInputId}
            className={cn(
              "builder-field-control tabular-nums",
              showLengthGhost && "text-transparent caret-builder-muted",
            )}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={lengthFocused ? draft : String(committedLength)}
            onFocus={onLengthFocus}
            onChange={onLengthChangeDraft}
            onBlur={onLengthBlur}
          />
        </div>
      </BuilderField>
      <BuilderSelectField
        label="Direction"
        id={directionSelectId}
        value={committedDirection}
        disabled={directionDisabled}
        onChange={(event) => {
          onDirectionChange(event.target.value === "vertical" ? "vertical" : "horizontal");
        }}
      >
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
      </BuilderSelectField>
    </div>
  );
};
