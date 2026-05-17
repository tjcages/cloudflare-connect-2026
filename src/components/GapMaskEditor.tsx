import { useCallback, useEffect, useRef, useState } from "react";
import type { GapMask } from "../grid/types";
import { cn } from "../lib/cn";

type GapMaskEditorProps = {
  mask: GapMask;
  onChange: (mask: GapMask) => void;
};

type SelectionPoint = {
  row: number;
  column: number;
};

type SelectionRange = {
  start: SelectionPoint;
  end: SelectionPoint;
};

const getRangeBounds = ({ start, end }: SelectionRange) => ({
  minRow: Math.min(start.row, end.row),
  maxRow: Math.max(start.row, end.row),
  minColumn: Math.min(start.column, end.column),
  maxColumn: Math.max(start.column, end.column),
});

const cellIsInRange = (row: number, column: number, range: SelectionRange | null) => {
  if (!range) {
    return false;
  }

  const { minRow, maxRow, minColumn, maxColumn } = getRangeBounds(range);

  return row >= minRow && row <= maxRow && column >= minColumn && column <= maxColumn;
};

export const GapMaskEditor = ({ mask, onChange }: GapMaskEditorProps) => {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef(mask);
  const selectionRef = useRef<SelectionRange | null>(null);
  const rows = mask.length;
  const columns = mask[0]?.length ?? 0;

  useEffect(() => {
    maskRef.current = mask;
  }, [mask]);

  const setActiveSelection = useCallback((nextSelection: SelectionRange | null) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }, []);

  const commitSelection = useCallback(() => {
    const activeSelection = selectionRef.current;

    if (!activeSelection) {
      return;
    }

    const { minRow, maxRow, minColumn, maxColumn } = getRangeBounds(activeSelection);
    const allSelectedCellsBlocked = maskRef.current
      .slice(minRow, maxRow + 1)
      .every((row) => row.slice(minColumn, maxColumn + 1).every(Boolean));
    const nextValue = !allSelectedCellsBlocked;
    const nextMask = maskRef.current.map((row, rowIndex) =>
      row.map((blocked, columnIndex) =>
        rowIndex >= minRow && rowIndex <= maxRow && columnIndex >= minColumn && columnIndex <= maxColumn
          ? nextValue
          : blocked,
      ),
    );

    maskRef.current = nextMask;
    onChange(nextMask);
    setActiveSelection(null);
  }, [onChange, setActiveSelection]);

  const getPointFromPointer = useCallback(
    (event: PointerEvent): SelectionPoint | null => {
      const grid = gridRef.current;

      if (!grid || rows === 0 || columns === 0) {
        return null;
      }

      const rect = grid.getBoundingClientRect();
      const cellWidth = rect.width / columns;
      const cellHeight = rect.height / rows;

      if (cellWidth === 0 || cellHeight === 0) {
        return null;
      }

      return {
        row: Math.min(rows - 1, Math.max(0, Math.floor((event.clientY - rect.top) / cellHeight))),
        column: Math.min(columns - 1, Math.max(0, Math.floor((event.clientX - rect.left) / cellWidth))),
      };
    },
    [columns, rows],
  );

  const updateSelectionFromPointer = useCallback(
    (event: PointerEvent) => {
      const activeSelection = selectionRef.current;

      if (!activeSelection) {
        return;
      }

      const end = getPointFromPointer(event);

      if (!end || (activeSelection.end.row === end.row && activeSelection.end.column === end.column)) {
        return;
      }

      setActiveSelection({
        ...activeSelection,
        end,
      });
    },
    [getPointFromPointer, setActiveSelection],
  );

  useEffect(() => {
    const cancelSelection = () => setActiveSelection(null);

    window.addEventListener("pointermove", updateSelectionFromPointer);
    window.addEventListener("pointerup", commitSelection);
    window.addEventListener("pointercancel", cancelSelection);

    return () => {
      window.removeEventListener("pointermove", updateSelectionFromPointer);
      window.removeEventListener("pointerup", commitSelection);
      window.removeEventListener("pointercancel", cancelSelection);
    };
  }, [commitSelection, setActiveSelection, updateSelectionFromPointer]);

  return (
    <div data-slot="builder-field" className="flex flex-col gap-1.5 text-[12px] text-builder-muted">
      <div className="flex items-center justify-between gap-2 leading-[calc(4em/3)]">
        <span>Gaps</span>
        <span className="text-[10px] leading-[1.1] text-builder-subtle">
          {columns} x {rows}
        </span>
      </div>
      <div
        ref={gridRef}
        className="grid touch-none select-none gap-0.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {mask.map((maskRow, row) =>
          maskRow.map((blocked, column) => {
            const isSelected = cellIsInRange(row, column, selection);

            return (
              <button
                className={cn(
                  "aspect-square cursor-crosshair rounded-sm border p-0",
                  blocked ? "border-builder-thumb-track bg-builder-thumb-track" : "border-builder-hairline bg-white",
                  isSelected && "border-builder-accent-border bg-builder-accent-fill",
                )}
                key={`${row}:${column}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActiveSelection({
                    start: { row, column },
                    end: { row, column },
                  });
                }}
                type="button"
                data-testid={`gap-mask-cell-${row}-${column}`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
};
