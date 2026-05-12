import { BASE_UNIT, type CandidateCell, type GapMask } from "./types";

export const createGapMask = (rows: number, columns: number, fill = false): GapMask =>
  Array.from({ length: rows }, () => Array.from({ length: columns }, () => fill));

export const resizeGapMask = (mask: GapMask, rows: number, columns: number): GapMask =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => mask[row]?.[column] ?? false),
  );

export const setMaskCell = (
  mask: GapMask,
  row: number,
  column: number,
  blocked: boolean,
): GapMask =>
  mask.map((maskRow, rowIndex) =>
    maskRow.map((cell, columnIndex) =>
      rowIndex === row && columnIndex === column ? blocked : cell,
    ),
  );

export const isMaskCellBlocked = (mask: GapMask, row: number, column: number): boolean =>
  mask[row]?.[column] ?? false;

export const candidateTouchesGap = (mask: GapMask, candidate: CandidateCell): boolean => {
  const startColumn = candidate.x / BASE_UNIT;
  const startRow = candidate.y / BASE_UNIT;
  const columns = candidate.width / BASE_UNIT;
  const rows = candidate.height / BASE_UNIT;

  for (let row = startRow; row < startRow + rows; row += 1) {
    for (let column = startColumn; column < startColumn + columns; column += 1) {
      if (isMaskCellBlocked(mask, row, column)) {
        return true;
      }
    }
  }

  return false;
};

export const applyPreviewCellToMask = (
  mask: GapMask,
  previewRow: number,
  previewColumn: number,
  previewRows: number,
  previewColumns: number,
  blocked: boolean,
): GapMask => {
  const rows = mask.length;
  const columns = mask[0]?.length ?? 0;
  const rowStart = Math.floor((previewRow / previewRows) * rows);
  const rowEnd = Math.max(rowStart + 1, Math.ceil(((previewRow + 1) / previewRows) * rows));
  const columnStart = Math.floor((previewColumn / previewColumns) * columns);
  const columnEnd = Math.max(
    columnStart + 1,
    Math.ceil(((previewColumn + 1) / previewColumns) * columns),
  );

  return mask.map((maskRow, rowIndex) =>
    maskRow.map((cell, columnIndex) => {
      const isInPreviewCell =
        rowIndex >= rowStart &&
        rowIndex < rowEnd &&
        columnIndex >= columnStart &&
        columnIndex < columnEnd;

      return isInPreviewCell ? blocked : cell;
    }),
  );
};

export const isPreviewCellBlocked = (
  mask: GapMask,
  previewRow: number,
  previewColumn: number,
  previewRows: number,
  previewColumns: number,
): boolean => {
  const rows = mask.length;
  const columns = mask[0]?.length ?? 0;
  const rowStart = Math.floor((previewRow / previewRows) * rows);
  const rowEnd = Math.max(rowStart + 1, Math.ceil(((previewRow + 1) / previewRows) * rows));
  const columnStart = Math.floor((previewColumn / previewColumns) * columns);
  const columnEnd = Math.max(
    columnStart + 1,
    Math.ceil(((previewColumn + 1) / previewColumns) * columns),
  );

  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let column = columnStart; column < columnEnd; column += 1) {
      if (isMaskCellBlocked(mask, row, column)) {
        return true;
      }
    }
  }

  return false;
};
