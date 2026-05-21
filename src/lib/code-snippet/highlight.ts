import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import type { Element, Root } from "hast";
import type { CodeSnippetLanguage } from "../../grid/types";
import type { PaletteThemeId } from "../../theme/palette";
import { getCodeSnippetSyntaxColors, type CodeSnippetSyntaxColors } from "./syntaxColors";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("json", json);
lowlight.register("bash", bash);

export type CodeSnippetToken = {
  text: string;
  colorHex: string;
};

type SyntaxRole = keyof CodeSnippetSyntaxColors;

const ACCENT_CLASSES = new Set([
  "class-name",
  "function",
  "function-variable",
  "property",
  "variable",
  "constant",
  "builtin",
  "tag",
  "selector",
  "namespace",
  "imports",
  "import-statement",
  "maybe-class-name",
  "parameter",
  "attr-name",
]);

const STRING_CLASSES = new Set(["string", "attr-value", "char", "regex", "meta"]);

const normalizeClassName = (className: unknown): string | undefined => {
  if (typeof className === "string") {
    return className;
  }
  if (Array.isArray(className)) {
    return className.filter((part): part is string => typeof part === "string").join(" ");
  }
  return undefined;
};

const prismLikeClass = (part: string): string => part.replace(/^hljs-/, "");

const classToRole = (className: unknown): SyntaxRole => {
  const normalized = normalizeClassName(className);
  if (!normalized) {
    return "mutedHex";
  }
  const parts = normalized.split(/\s+/).map(prismLikeClass);
  for (const part of parts) {
    if (STRING_CLASSES.has(part) || part === "string") {
      return "stringHex";
    }
    if (ACCENT_CLASSES.has(part) || part === "title" || part === "class_" || part === "built_in") {
      return "accentHex";
    }
    if (part === "keyword") {
      return "accentHex";
    }
  }
  return "mutedHex";
};

const collectTokensFromHast = (
  node: Root | Element,
  colors: CodeSnippetSyntaxColors,
  out: CodeSnippetToken[],
): void => {
  for (const child of node.children) {
    if (child.type === "text") {
      if (child.value.length > 0) {
        out.push({ text: child.value, colorHex: colors.mutedHex });
      }
      continue;
    }
    if (child.type === "element") {
      const role = classToRole(child.properties.className);
      const colorHex = colors[role];
      for (const inner of child.children) {
        if (inner.type === "text" && inner.value.length > 0) {
          out.push({ text: inner.value, colorHex });
        } else if (inner.type === "element") {
          collectTokensFromHast(inner, colors, out);
        }
      }
    }
  }
};

const looksLikeShell = (code: string): boolean =>
  /--[\w-]/.test(code) || /\b(wrangler|npm|npx|pnpm|yarn|node|deno|git|curl|bash|sh)\b/i.test(code);

const resolveHighlightLanguage = (language: CodeSnippetLanguage, code: string): string | null => {
  if (language === "text") {
    return null;
  }
  if (language !== "auto") {
    return language;
  }
  const detected = lowlight.highlightAuto(code).data?.language;
  if (detected) {
    return detected;
  }
  if (looksLikeShell(code)) {
    return "bash";
  }
  return "bash";
};

const plainTextTokens = (code: string, colors: CodeSnippetSyntaxColors): CodeSnippetToken[] => [
  { text: code, colorHex: colors.mutedHex },
];

const SHELL_LINE_RE = /(\s+|--?[\w][\w-]*|\/[^\s]*|[^\s]+)/g;

const tokenizeShellLine = (line: string, colors: CodeSnippetSyntaxColors): CodeSnippetToken[] => {
  const tokens: CodeSnippetToken[] = [];
  let commandWordIndex = 0;
  for (const match of line.matchAll(SHELL_LINE_RE)) {
    const part = match[0];
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, colorHex: colors.mutedHex });
      continue;
    }
    if (/^--/.test(part) || /^-[a-zA-Z]$/.test(part)) {
      tokens.push({ text: part, colorHex: colors.stringHex });
      continue;
    }
    if (commandWordIndex === 1) {
      tokens.push({ text: part, colorHex: colors.accentHex });
      commandWordIndex += 1;
      continue;
    }
    tokens.push({ text: part, colorHex: colors.mutedHex });
    commandWordIndex += 1;
  }
  return tokens;
};

/** highlight.js bash leaves most CLI invocations as plain text; apply role colors ourselves. */
export const tokenizeShellSource = (code: string, colors: CodeSnippetSyntaxColors): CodeSnippetToken[] => {
  const tokens: CodeSnippetToken[] = [];
  const lines = code.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lineIndex > 0) {
      tokens.push({ text: "\n", colorHex: colors.mutedHex });
    }
    tokens.push(...tokenizeShellLine(lines[lineIndex] ?? "", colors));
  }
  return tokens;
};

export const tokenizeCodeSnippet = (
  code: string,
  language: CodeSnippetLanguage,
  themeId: PaletteThemeId,
  gridStrokeHex?: string,
): CodeSnippetToken[] => {
  const colors = getCodeSnippetSyntaxColors(themeId, {
    neutralFillSyncHex: gridStrokeHex,
  });

  if (!code.length) {
    return [];
  }

  const lang = resolveHighlightLanguage(language, code);
  if (lang === null) {
    return plainTextTokens(code, colors);
  }

  if (lang === "bash") {
    return tokenizeShellSource(code, colors);
  }

  let tree: Root;
  try {
    tree = lowlight.highlight(lang, code);
  } catch {
    return plainTextTokens(code, colors);
  }

  const tokens: CodeSnippetToken[] = [];
  collectTokensFromHast(tree, colors, tokens);
  return tokens.length > 0 ? tokens : plainTextTokens(code, colors);
};
