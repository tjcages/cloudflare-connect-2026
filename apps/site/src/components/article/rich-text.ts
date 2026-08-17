export type RichTextSegment =
  | { type: "text"; value: string }
  | { type: "link"; children: RichTextSegment[]; href: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: RichTextSegment[] }
  | { type: "em"; children: RichTextSegment[] };

const ESCAPABLE = new Set(["[", "]", "(", ")", "`", "*", "_", "\\"]);

function unescape(value: string) {
  let out = "";

  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && ESCAPABLE.has(value[i + 1])) {
      out += value[i + 1];
      i++;
      continue;
    }

    out += value[i];
  }

  return out;
}

const WORD = /[\p{L}\p{N}]/u;

function findEmphasisClose(text: string, from: number) {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }

    if (text[i] === "_" && !WORD.test(text[i + 1] ?? "")) return i;
  }

  return -1;
}

function findClose(text: string, from: number, marker: string) {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }

    if (text.startsWith(marker, i)) return i;
  }

  return -1;
}

export function parseRichText(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];

  let buffer = "";
  let cursor = 0;

  const flush = () => {
    if (buffer) segments.push({ type: "text", value: buffer });
    buffer = "";
  };

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "\\" && ESCAPABLE.has(text[cursor + 1])) {
      buffer += text[cursor + 1];
      cursor += 2;
      continue;
    }

    if (char === "`") {
      const close = text.indexOf("`", cursor + 1);

      if (close > cursor + 1) {
        flush();
        segments.push({ type: "code", value: text.slice(cursor + 1, close) });
        cursor = close + 1;
        continue;
      }
    }

    if (char === "[") {
      const labelEnd = findClose(text, cursor + 1, "]");

      if (labelEnd > cursor + 1 && text[labelEnd + 1] === "(") {
        const hrefEnd = findClose(text, labelEnd + 2, ")");

        if (hrefEnd > labelEnd + 2) {
          flush();
          segments.push({
            type: "link",
            children: parseRichText(text.slice(cursor + 1, labelEnd)),
            href: unescape(text.slice(labelEnd + 2, hrefEnd)),
          });
          cursor = hrefEnd + 1;
          continue;
        }
      }
    }

    if (char === "*" && text[cursor + 1] === "*") {
      const close = findClose(text, cursor + 2, "**");

      if (close > cursor + 2) {
        flush();
        segments.push({
          type: "strong",
          children: parseRichText(text.slice(cursor + 2, close)),
        });
        cursor = close + 2;
        continue;
      }
    }

    if (char === "_" && !WORD.test(text[cursor - 1] ?? "")) {
      const close = findEmphasisClose(text, cursor + 1);

      if (close > cursor + 1) {
        flush();
        segments.push({
          type: "em",
          children: parseRichText(text.slice(cursor + 1, close)),
        });
        cursor = close + 1;
        continue;
      }
    }

    buffer += char;
    cursor++;
  }

  flush();

  return segments;
}

export function richTextToPlain(text: string): string {
  const walk = (segments: RichTextSegment[]): string =>
    segments
      .map((segment) =>
        segment.type === "text" || segment.type === "code"
          ? segment.value
          : walk(segment.children)
      )
      .join("");

  return walk(parseRichText(text));
}
