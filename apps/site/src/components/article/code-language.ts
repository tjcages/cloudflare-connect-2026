const UNSUPPORTED_GRAMMARS = [
  /\bfn\s+\w+\s*[(<]|\bpub\s*(\(crate\))?\s+fn\b|&mut\s+self|\)\?[;,)]|\bimpl\s+\w+\s+for\b/,
  /^package\s+\w+\s*$|\bfunc\s*\(/m,
  /^\s*syntax\s*=\s*"proto[23]"/m,
  /^\s*(server|http|location|upstream)\s*\{\s*$|^\s*(listen|ssl_certificate|ssl_protocols|proxy_pass|server_name)\s+\S/m,
];

const JSON_KEY = /"[^"\n]*"\s*:/;
const JSON_DISQUALIFIER =
  /=>|\b(function|await|async|return|class|import|export|new)\b|\b(const|let|var)\s+[A-Za-z_$]/;

const YAML_SEQUENCE = /^\s*-\s+[\w"'./@-]+\s*:/m;
const YAML_MAPPING = /^\s*[\w.-]+:\s*$/m;
const YAML_EXPRESSION = /\$\{\{/;

const HTML_OPENER = /^\s*<(!--|!doctype|\/?[a-z][\w-]*[\s>/])/i;

const PYTHON_MARKERS =
  /^\s*from\s+[\w.]+\s+import\s|^\s*import\s+[\w.]+\s*$|^\s*(async\s+)?def\s+\w+\s*\(|^\s*class\s+\w+(\([\w., ]*\))?\s*:/m;

const SQL_MARKERS =
  /^\s*(select\s+[\s\S]*\sfrom\s|insert\s+into\s|update\s+\w+\s+set\s|delete\s+from\s|create\s+(table|index|view)\s|alter\s+table\s)/im;

const SHELL_COMMAND =
  /^\s*(\$\s+)?(sudo\s+)?(curl|wget|npm|npx|pnpm|yarn|bun|git|cd|ls|cat|echo|mkdir|rm|cp|mv|ssh|scp|brew|apt|apt-get|docker|kubectl|wrangler|openssl|ffmpeg|ffplay|jq|grep|sed|awk|tar|chmod|chown|node|deno|python3?|pip3?|cargo|rustup|make)\b|^\s*export\s+[A-Z_][A-Z0-9_]*=/;
const SHELL_INVOCATION =
  /^\s*(\$\s+)?[a-z][\w.-]*\s+(https?:\/\/|-{1,2}[a-zA-Z])/;
const SHELL_FRAGMENT = /\\$|--[\w-]+|\$[A-Za-z_{(]|\s\|\s|^\s*\$\s/;

const SCRIPT_KEYWORDS =
  /\b(function|return|await|async|import|export|class|interface|extends|implements|new|typeof)\b|\b(const|let|var)\s+[A-Za-z_$]/g;
const SCRIPT_ARROWS = /=>/g;
const SCRIPT_SHAPE = /[;{}()]/;

function count(code: string, pattern: RegExp): number {
  return code.match(pattern)?.length ?? 0;
}

function looksLikeShell(code: string): boolean {
  const lines = code
    .split("\n")
    .filter((line) => line.trim() && !/^\s*#/.test(line));

  if (!lines.length) return false;
  if (/^#!/.test(code)) return true;

  const isCommand = (line: string) =>
    SHELL_COMMAND.test(line) || SHELL_INVOCATION.test(line);

  if (isCommand(lines[0])) return true;
  if (!lines.some(isCommand)) return false;

  const shellish = lines.filter(
    (line) => isCommand(line) || SHELL_FRAGMENT.test(line)
  );

  return shellish.length / lines.length >= 0.5;
}

export function detectArticleCodeLanguage(code: string): string | null {
  const trimmed = code.trim();

  if (!trimmed) return null;
  if (UNSUPPORTED_GRAMMARS.some((pattern) => pattern.test(trimmed)))
    return null;

  if (
    /^[{["]/.test(trimmed) &&
    JSON_KEY.test(trimmed) &&
    !JSON_DISQUALIFIER.test(trimmed)
  ) {
    return "json";
  }

  if (
    YAML_EXPRESSION.test(trimmed) ||
    (YAML_SEQUENCE.test(trimmed) && YAML_MAPPING.test(trimmed))
  ) {
    return "yaml";
  }

  if (HTML_OPENER.test(trimmed)) return "html";
  if (PYTHON_MARKERS.test(trimmed)) return "python";
  if (SQL_MARKERS.test(trimmed)) return "sql";
  if (looksLikeShell(trimmed)) return "bash";

  const script =
    count(trimmed, SCRIPT_KEYWORDS) + count(trimmed, SCRIPT_ARROWS);

  return script && SCRIPT_SHAPE.test(trimmed) ? "typescript" : null;
}
