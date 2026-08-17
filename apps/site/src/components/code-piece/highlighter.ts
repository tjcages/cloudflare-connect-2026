import {
  createHighlighterCoreSync,
  type HighlighterCore,
  type ThemeRegistrationRaw,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import jsx from "shiki/langs/jsx.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import yaml from "shiki/langs/yaml.mjs";

const orange = "var(--color-orange-900)";
const purple = "var(--color-purple-900)";
const blue = "var(--color-blue-900)";
const green = "var(--color-green-900)";
const red = "var(--color-red-900)";
const identifier = "var(--color-text-default)";
const gray = "var(--color-icon-subtle)";

const theme: ThemeRegistrationRaw = {
  name: "code-piece",
  type: "light",
  fg: gray,
  bg: "transparent",
  settings: [
    { settings: { foreground: gray, background: "transparent" } },
    { scope: ["comment"], settings: { foreground: gray } },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "punctuation.accessor",
        "punctuation.terminator",
        "punctuation.separator",
        "keyword.operator",
      ],
      settings: { foreground: gray },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language",
      ],
      settings: { foreground: purple },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: orange },
    },
    {
      scope: [
        "string.unquoted.argument",
        "variable.other.normal",
        "entity.name.command",
      ],
      settings: { foreground: purple },
    },
    {
      scope: ["punctuation.definition.string"],
      settings: { foreground: gray },
    },
    {
      scope: ["constant.character.escape.line-continuation"],
      settings: { foreground: blue },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: red },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: blue },
    },
    {
      scope: [
        "entity.name.tag",
        "support.class.component",
        "meta.function.decorator",
      ],
      settings: { foreground: blue },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: purple },
    },
    {
      scope: ["new.expr entity.name.function"],
      settings: { foreground: green },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.class",
        "support.type",
        "support.constant",
        "entity.other.inherited-class",
      ],
      settings: { foreground: green },
    },
    {
      scope: ["support.type.property-name"],
      settings: { foreground: identifier },
    },
    {
      scope: [
        "variable",
        "variable.other",
        "variable.parameter",
        "variable.other.object",
        "variable.other.property",
        "variable.other.constant",
        "variable.other.readwrite",
        "meta.definition.variable",
      ],
      settings: { foreground: identifier },
    },
    {
      scope: [
        "meta.object-literal.key",
        "meta.object-literal.key string.quoted",
        "meta.object-literal.key string.template",
      ],
      settings: { foreground: identifier },
    },
  ],
};

const duotoneTheme: ThemeRegistrationRaw = {
  name: "code-piece-duotone",
  type: "light",
  fg: gray,
  bg: "transparent",
  settings: [
    { settings: { foreground: gray, background: "transparent" } },
    { scope: ["comment"], settings: { foreground: gray } },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "punctuation.accessor",
        "punctuation.terminator",
        "punctuation.separator",
        "keyword.operator",
      ],
      settings: { foreground: gray },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language",
      ],
      settings: { foreground: orange },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: orange },
    },
    {
      scope: ["keyword.control.import", "keyword.control.from"],
      settings: { foreground: gray },
    },
    {
      scope: ["meta.import string.quoted", "meta.import string.template"],
      settings: { foreground: purple },
    },
    {
      scope: [
        "string.unquoted.argument",
        "variable.other.normal",
        "entity.name.command",
      ],
      settings: { foreground: purple },
    },
    {
      scope: ["punctuation.definition.string"],
      settings: { foreground: gray },
    },
    {
      scope: ["constant.character.escape.line-continuation"],
      settings: { foreground: blue },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: orange },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: purple },
    },
    {
      scope: ["new.expr entity.name.function"],
      settings: { foreground: orange },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.class",
        "support.type",
        "support.constant",
        "entity.other.inherited-class",
      ],
      settings: { foreground: orange },
    },
    {
      scope: ["support.type.property-name"],
      settings: { foreground: purple },
    },
    {
      scope: [
        "variable",
        "variable.other",
        "variable.parameter",
        "variable.other.object",
        "variable.other.property",
        "variable.other.constant",
        "variable.other.readwrite",
        "meta.definition.variable",
      ],
      settings: { foreground: purple },
    },
    {
      scope: ["variable.other.readwrite.alias"],
      settings: { foreground: orange },
    },
    {
      scope: [
        "meta.object-literal.key",
        "meta.object-literal.key string.quoted",
        "meta.object-literal.key string.template",
      ],
      settings: { foreground: purple },
    },
  ],
};

const terminalPurple = "#b392f0";
const terminalBlue = "#79b8ff";
const terminalString = "#9ecbff";
const terminalIdentifier = "#e1e4e8";
const terminalGray = "#6a737d";

const terminalTheme: ThemeRegistrationRaw = {
  name: "code-terminal",
  type: "dark",
  fg: terminalIdentifier,
  bg: "transparent",
  settings: [
    {
      settings: { foreground: terminalIdentifier, background: "transparent" },
    },
    { scope: ["comment"], settings: { foreground: terminalGray } },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language",
      ],
      settings: { foreground: terminalPurple },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "string.unquoted.argument",
        "punctuation.definition.string",
      ],
      settings: { foreground: terminalString },
    },
    {
      scope: ["entity.name.command", "variable.other.normal"],
      settings: { foreground: terminalPurple },
    },
    {
      scope: [
        "constant.character.escape.line-continuation",
        "constant.other.option",
        "constant.numeric",
        "constant.language",
      ],
      settings: { foreground: terminalBlue },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: terminalBlue },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.class",
        "support.type",
        "support.constant",
        "entity.other.inherited-class",
      ],
      settings: { foreground: terminalBlue },
    },
  ],
};

const codePieceAliases: Record<string, string> = {
  ts: "typescript",
  typescript: "typescript",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  py: "python",
  python: "python",
  html: "html",
  htm: "html",
  css: "css",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  sh: "bash",
  shell: "bash",
  bash: "bash",
  zsh: "bash",
  tsx: "tsx",
  yml: "yaml",
  yaml: "yaml",
};

export function resolveCodePieceLanguage(language: string): string | null {
  return codePieceAliases[language.toLowerCase()] ?? null;
}

export function detectCodePieceLanguage(code: string): string {
  const trimmed = code.trim();

  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      return "typescript";
    }
  }

  const count = (re: RegExp) => trimmed.match(re)?.length ?? 0;

  const bashScore =
    count(/^#!.*\b(ba|z)?sh\b/m) * 10 +
    count(
      /^\s*(curl|git|npm|pnpm|npx|yarn|brew|cd|echo|mkdir|wrangler|ssh|cat|grep|docker|node)\b/gm
    ) *
      4 +
    count(/\\\s*$/gm) * 2 +
    count(/^\s*#(?!!)/gm) * 2 +
    count(/\$[A-Z_][A-Z0-9_]+/g) * 2 +
    count(/(?<=\s)--?[a-zA-Z][\w-]*/g);

  const script =
    count(
      /\b(const|let|var|function|return|await|async|import|export|new|if|else|for|while)\b/g
    ) + count(/=>/g);

  if (bashScore > script) return "bash";

  const typescriptMarkers =
    count(
      /:\s*(string|number|boolean|void|unknown|any|never|Promise|Record|Array)\b/g
    ) +
    count(/\b(interface|satisfies|implements|readonly|enum)\b/g) +
    count(/\btype\s+[A-Z]\w*\s*=/g) +
    count(/\bas\s+(const\b|[A-Z]\w*)/g) +
    count(/:\s*[A-Z]\w*(\[\])?[\s;,)=]/g);

  return typescriptMarkers > 0 || script === 0 ? "typescript" : "javascript";
}

let instance: HighlighterCore | undefined;

function getCodePieceHighlighter(): HighlighterCore {
  instance ??= createHighlighterCoreSync({
    themes: [theme, duotoneTheme, terminalTheme],
    langs: [
      typescript,
      tsx,
      javascript,
      jsx,
      python,
      html,
      css,
      json,
      bash,
      yaml,
      markdown,
      sql,
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return instance;
}

export function highlightCodePiece(
  code: string,
  language?: string,
  options?: { duotone?: boolean; terminal?: boolean }
): string {
  const lang = language
    ? (codePieceAliases[language] ?? "typescript")
    : detectCodePieceLanguage(code);

  try {
    return getCodePieceHighlighter().codeToHtml(code, {
      lang,
      theme: options?.terminal
        ? "code-terminal"
        : options?.duotone
          ? "code-piece-duotone"
          : "code-piece",
      structure: "inline",
    });
  } catch {
    return code;
  }
}
