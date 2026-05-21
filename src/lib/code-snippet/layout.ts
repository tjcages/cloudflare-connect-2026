import { SMALL_CELL_SIZE, type CodeSnippetProps, type ComponentInstance } from "../../grid/types";

export type CodeSnippetInstanceUnion = Extract<ComponentInstance, { type: "code-snippet" }>;

export const isCodeSnippetInstance = (instance: ComponentInstance): instance is CodeSnippetInstanceUnion =>
  instance.type === "code-snippet";

export const CODE_SNIPPET_CELL_MIN = 2;
export const CODE_SNIPPET_CELL_MAX = 32;

export const normalizeCodeSnippetCells = (n: number): number =>
  Math.min(
    CODE_SNIPPET_CELL_MAX,
    Math.max(CODE_SNIPPET_CELL_MIN, Math.floor(Number.isFinite(n) ? n : CODE_SNIPPET_CELL_MIN)),
  );

export const normalizeCodeSnippetProps = (
  props: Partial<CodeSnippetProps> & { containerHighlighted?: unknown },
  defaults: CodeSnippetProps,
): CodeSnippetProps => {
  const { containerHighlighted: _legacyHighlight, ...rest } = props;
  return {
    ...defaults,
    ...rest,
    widthCells: normalizeCodeSnippetCells(rest.widthCells ?? defaults.widthCells),
    heightCells: normalizeCodeSnippetCells(rest.heightCells ?? defaults.heightCells),
  };
};

export type CodeSnippetMetrics = {
  width: number;
  height: number;
  snapAnchorX: number;
  snapAnchorY: number;
};

export const getCodeSnippetMetrics = (props: CodeSnippetProps): CodeSnippetMetrics => {
  const widthCells = normalizeCodeSnippetCells(props.widthCells);
  const heightCells = normalizeCodeSnippetCells(props.heightCells);
  return {
    width: widthCells * SMALL_CELL_SIZE,
    height: heightCells * SMALL_CELL_SIZE,
    snapAnchorX: 0,
    snapAnchorY: 0,
  };
};
