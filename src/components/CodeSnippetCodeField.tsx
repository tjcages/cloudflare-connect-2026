import { useRef, type ClipboardEvent } from "react";
import type { CodeSnippetLanguage } from "../grid/types";
import { BuilderTextareaField } from "./BuilderTextareaField";

type CodeSnippetCodeFieldProps = {
  id: string;
  value: string;
  language: CodeSnippetLanguage;
  onChange: (code: string) => void;
};

export const CodeSnippetCodeField = ({ id, value, language, onChange }: CodeSnippetCodeFieldProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text/plain");
    if (!pasted) {
      return;
    }

    event.preventDefault();

    const { formatCodeSnippet } = await import("../lib/code-snippet/formatCode");
    const formatted = await formatCodeSnippet(pasted, language);
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${formatted}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      if (!el) {
        return;
      }
      const caret = start + formatted.length;
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <BuilderTextareaField
      ref={textareaRef}
      label="Code"
      id={id}
      rows={6}
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPaste={handlePaste}
      data-testid={`code-snippet-code-${id}`}
    />
  );
};
