import * as prettier from "prettier/standalone";
import * as prettierPluginBabel from "prettier/plugins/babel";
import * as prettierPluginEstree from "prettier/plugins/estree";
import * as prettierPluginTypescript from "prettier/plugins/typescript";
import type { CodeSnippetLanguage } from "../../grid/types";

const PRETTIER_PLUGINS = [prettierPluginBabel, prettierPluginEstree, prettierPluginTypescript];

const looksLikeJson = (code: string): boolean => {
  const t = code.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
};

const looksLikeTypeScript = (code: string): boolean =>
  /\b(interface|type|enum|declare|namespace|implements|readonly|as const)\b/.test(code) ||
  /:\s*[A-Za-z_][\w$<>[\].|&]*/.test(code);

export const resolvePrettierParser = (
  language: CodeSnippetLanguage,
  code: string,
): "babel" | "typescript" | "json" | null => {
  if (language === "json") {
    return "json";
  }
  if (language === "typescript") {
    return "typescript";
  }
  if (language === "javascript") {
    return "babel";
  }
  if (language === "bash" || language === "text") {
    return null;
  }

  if (looksLikeJson(code)) {
    return "json";
  }
  if (looksLikeTypeScript(code)) {
    return "typescript";
  }
  return "babel";
};

export const formatCodeSnippet = async (code: string, language: CodeSnippetLanguage): Promise<string> => {
  if (!code.trim()) {
    return code;
  }

  const parser = resolvePrettierParser(language, code);
  if (!parser) {
    return code;
  }

  try {
    return await prettier.format(code, {
      parser,
      plugins: PRETTIER_PLUGINS,
      printWidth: 80,
      semi: true,
      singleQuote: false,
    });
  } catch {
    return code;
  }
};
