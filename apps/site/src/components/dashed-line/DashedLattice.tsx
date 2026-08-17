const DASH = 3;
const PERIOD = 8;
const CLEARANCE = 13;

const fittedDashArray = (
  length: number,
  startInset: number,
  endInset: number
) => {
  const usable = length - startInset - endInset;
  if (usable < DASH) {
    return null;
  }

  const count = Math.max(1, Math.round((usable - DASH) / PERIOD) + 1);
  const gap =
    count > 1 ? +((usable - count * DASH) / (count - 1)).toFixed(4) : 0;
  const run = Array.from({ length: count }, () => `${DASH} ${gap}`).join(" ");

  return `0 ${startInset} ${run} 0 ${length}`;
};

const runsAlong = (total: number, crosses: number[]) => {
  const stops = [0, ...crosses, total];

  return stops.slice(0, -1).map((from, i) => ({
    from,
    to: stops[i + 1],
    startInset: i === 0 ? 0 : CLEARANCE,
    endInset: i === stops.length - 2 ? 0 : CLEARANCE,
  }));
};

export default function DashedLattice({
  w,
  h,
  xs,
  ys,
}: {
  w: number;
  h: number;
  xs: number[];
  ys: number[];
}) {
  return (
    <>
      {xs.map((x) =>
        runsAlong(h, ys).map((run) => {
          const dashArray = fittedDashArray(
            run.to - run.from,
            run.startInset,
            run.endInset
          );

          return (
            dashArray && (
              <line
                key={`v-${x}-${run.from}`}
                stroke="currentColor"
                strokeDasharray={dashArray}
                x1={x}
                x2={x}
                y1={run.from}
                y2={run.to}
              />
            )
          );
        })
      )}

      {ys.map((y) =>
        runsAlong(w, xs).map((run) => {
          const dashArray = fittedDashArray(
            run.to - run.from,
            run.startInset,
            run.endInset
          );

          return (
            dashArray && (
              <line
                key={`h-${y}-${run.from}`}
                stroke="currentColor"
                strokeDasharray={dashArray}
                x1={run.from}
                x2={run.to}
                y1={y}
                y2={y}
              />
            )
          );
        })
      )}

      {xs.flatMap((x) =>
        ys.map((y) => (
          <circle
            cx={x}
            cy={y}
            fill="currentColor"
            key={`dot-${x}-${y}`}
            r="1"
            shapeRendering="geometricPrecision"
          />
        ))
      )}
    </>
  );
}
