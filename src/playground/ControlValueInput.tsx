import {
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
  type KeyboardEventHandler,
} from "react";
import { clampControlValue, parseControlValueDraft } from "./controlValueParsing";

export type ControlValueInputProps = {
  value: number;
  /** Bounds checked on commit (stored units unless parseEditDraft converts). */
  inputMin: number;
  inputMax: number;
  /** Bounds applied on commit; defaults to inputMin/inputMax. */
  commitMin?: number;
  commitMax?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  formatDisplay?: (value: number) => string;
  /** Shown while focused; defaults to String(value). */
  formatEditValue?: (value: number) => string;
  /** Parses focused draft to stored value on commit. */
  parseEditDraft?: (draft: string) => number | null;
  ariaLabel: string;
};

export function ControlValueInput({
  value: committed,
  inputMin,
  inputMax,
  commitMin = inputMin,
  commitMax = inputMax,
  disabled = false,
  onChange,
  formatDisplay,
  formatEditValue,
  parseEditDraft,
  ariaLabel,
}: ControlValueInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = draft !== null;
  const display = formatDisplay?.(committed) ?? String(committed);

  useEffect(() => {
    setDraft(null);
  }, [committed]);

  const resolveCommittedValue = (text: string): number => {
    const parsed = parseEditDraft ? parseEditDraft(text) : parseControlValueDraft(text);
    if (parsed === null) {
      return committed;
    }
    return clampControlValue(parsed, commitMin, commitMax);
  };

  const commitDraft = () => {
    const text = draft ?? String(committed);
    const next = resolveCommittedValue(text);
    setDraft(null);
    if (next !== committed) {
      onChange(next);
    }
  };

  const onFocus: FocusEventHandler<HTMLInputElement> = () => {
    setDraft(formatEditValue?.(committed) ?? String(committed));
  };

  const onChangeDraft: ChangeEventHandler<HTMLInputElement> = (event) => {
    setDraft(event.target.value);
  };

  const onBlur: FocusEventHandler<HTMLInputElement> = () => {
    commitDraft();
  };

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-[4.5rem] shrink-0 rounded border border-transparent bg-transparent px-1 py-0 text-right text-xs tabular-nums text-neutral-500 hover:border-neutral-200 focus:border-neutral-300 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-100"
      value={focused ? draft : display}
      onFocus={onFocus}
      onChange={onChangeDraft}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
