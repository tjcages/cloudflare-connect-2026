type Reading = {
  card: string;
  axis: "x" | "y";
  snake: number;
  rule: number;
  delta: number;
};

const ROOT_ATTRS = [
  "data-fullstack-visual",
  "data-email-fullstack-visual",
  "data-containers-fullstack-visual",
  "data-sandboxes-fullstack-visual",
  "data-pages-visual",
  "data-usecases-visual",
  "data-wfp-fullstack-visual",
];

const TOLERANCE = 0.05;

function paintedBox(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width === 0) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const columns = new Float64Array(canvas.width);
  const rows = new Float64Array(canvas.height);
  let total = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      columns[x] += alpha;
      rows[y] += alpha;
      total += alpha;
    }
  }
  if (total === 0) return null;

  const spread = (weights: Float64Array) => {
    let first = -1;
    let last = -1;
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] === 0) continue;
      if (first < 0) first = i;
      last = i;
      sum += (i + 0.5) * weights[i];
    }
    return { centroid: sum / total, extent: last - first + 1 };
  };

  return { columns: spread(columns), rows: spread(rows) };
}

// A rule is a 1px div; its optical centre is half a pixel past its edge.
function nearestRule(root: HTMLElement, axis: "x" | "y", target: number) {
  const rootRect = root.getBoundingClientRect();
  let best: number | null = null;
  for (const el of root.querySelectorAll<HTMLElement>("div")) {
    const rect = el.getBoundingClientRect();
    const thin = axis === "x" ? rect.width : rect.height;
    const long = axis === "x" ? rect.height : rect.width;
    if (thin <= 0 || thin > 2 || long < 24) continue;
    const centre =
      axis === "x"
        ? rect.left - rootRect.left + rect.width / 2
        : rect.top - rootRect.top + rect.height / 2;
    if (best === null || Math.abs(centre - target) < Math.abs(best - target)) {
      best = centre;
    }
  }
  return best;
}

async function readCard(
  root: HTMLElement,
  name: string
): Promise<Reading | null> {
  const canvas = root.querySelector("canvas");
  if (!canvas) return null;

  for (let attempt = 0; attempt < 120; attempt++) {
    const box = paintedBox(canvas);
    if (box) {
      // Read the rect at measure time: scrolling the card into view can resize
      // the canvas after the poll starts, and a stale scale invents an offset.
      const scale = canvas.width / root.getBoundingClientRect().width;
      // A connector runs along one axis; the long side tells us which.
      const axis: "x" | "y" = box.rows.extent >= box.columns.extent ? "x" : "y";
      const snake =
        (axis === "x" ? box.columns.centroid : box.rows.centroid) / scale;
      const rule = nearestRule(root, axis, snake);
      if (rule === null) return null;
      return {
        card: name,
        axis,
        snake: Number(snake.toFixed(3)),
        rule: Number(rule.toFixed(3)),
        delta: Number((snake - rule).toFixed(3)),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

function render(readings: Reading[]) {
  const panel = document.createElement("div");
  panel.className =
    "fixed top-16 right-16 z-50 max-h-[80vh] w-320 overflow-auto rounded-8 bg-background-surface p-16 text-mono-x-small before:inside-border before:border-border-default";

  const failures = readings.filter((r) => Math.abs(r.delta) > TOLERANCE);
  const heading = document.createElement("div");
  heading.className = "mb-12 text-label-small text-text-base";
  heading.textContent = failures.length
    ? `${failures.length} of ${readings.length} off the rule`
    : `all ${readings.length} on the rule`;
  panel.appendChild(heading);

  for (const reading of readings) {
    const row = document.createElement("div");
    const off = Math.abs(reading.delta) > TOLERANCE;
    row.className = off
      ? "flex justify-between gap-12 text-orange-900"
      : "flex justify-between gap-12 text-text-muted";
    row.innerHTML = `<span>${reading.card}</span><span>${
      reading.delta > 0 ? "+" : ""
    }${reading.delta}px</span>`;
    panel.appendChild(row);
  }

  document.body.appendChild(panel);
}

export async function runAlignAudit() {
  const roots: { root: HTMLElement; name: string }[] = [];
  for (const attr of ROOT_ATTRS) {
    for (const root of document.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      roots.push({ root, name: root.getAttribute(attr) || attr });
    }
  }

  const readings: Reading[] = [];
  for (const { root, name } of roots) {
    root.scrollIntoView({ block: "center" });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const reading = await readCard(root, name);
    if (reading) readings.push(reading);
  }

  render(readings);

  console.table(readings);
  return readings;
}
