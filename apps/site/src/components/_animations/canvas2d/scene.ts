type Paint = {
  color?: number | string;
  alpha?: number;
  width?: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
};

type Op =
  | { kind: "move"; x: number; y: number }
  | { kind: "line"; x: number; y: number }
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "stroke"; paint: Paint }
  | { kind: "fill"; paint: Paint };

const css = (color: number | string | undefined, fallback: string) => {
  if (color === undefined) return fallback;
  if (typeof color === "string") return color;
  return `#${color.toString(16).padStart(6, "0")}`;
};

const normalise = (paint: Paint | number | string): Paint =>
  typeof paint === "object" ? paint : { color: paint };

export class Node {
  visible = true;
  alpha = 1;
  position = {
    x: 0,
    y: 0,
    set(x: number, y: number) {
      this.x = x;
      this.y = y;
    },
  };
  scale = {
    x: 1,
    y: 1,
    set(x: number, y?: number) {
      this.x = x;
      this.y = y ?? x;
    },
  };
  parent: Container | null = null;

  destroy(_options?: unknown) {
    this.parent?.removeChild(this);
  }

  render(_ctx: CanvasRenderingContext2D) {}
}

export class Container extends Node {
  children: Node[] = [];

  addChild<T extends Node>(...nodes: T[]): T {
    for (const node of nodes) {
      node.parent?.removeChild(node);
      node.parent = this;
      this.children.push(node);
    }
    return nodes[nodes.length - 1];
  }

  removeChild(node: Node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parent = null;
  }

  removeChildren() {
    for (const child of this.children) child.parent = null;
    this.children.length = 0;
  }

  override destroy(options?: { children?: boolean }) {
    if (options?.children)
      for (const child of [...this.children]) child.destroy(options);
    this.removeChildren();
    super.destroy();
  }

  override render(ctx: CanvasRenderingContext2D) {
    if (!this.visible || this.alpha <= 0) return;
    const scaled = this.scale.x !== 1 || this.scale.y !== 1;
    const shifted = this.position.x !== 0 || this.position.y !== 0;
    const faded = this.alpha !== 1;
    if (shifted || faded || scaled) {
      ctx.save();
      if (shifted) ctx.translate(this.position.x, this.position.y);
      if (scaled) ctx.scale(this.scale.x, this.scale.y);
      if (faded) ctx.globalAlpha *= this.alpha;
    }
    for (const child of this.children) child.render(ctx);
    if (shifted || faded || scaled) ctx.restore();
  }
}

export class Graphics extends Node {
  private ops: Op[] = [];

  clear() {
    this.ops.length = 0;
    return this;
  }

  moveTo(x: number, y: number) {
    this.ops.push({ kind: "move", x, y });
    return this;
  }

  lineTo(x: number, y: number) {
    this.ops.push({ kind: "line", x, y });
    return this;
  }

  circle(x: number, y: number, r: number) {
    this.ops.push({ kind: "circle", x, y, r });
    return this;
  }

  rect(x: number, y: number, w: number, h: number) {
    this.ops.push({ kind: "rect", x, y, w, h });
    return this;
  }

  stroke(paint: Paint | number | string) {
    this.ops.push({ kind: "stroke", paint: normalise(paint) });
    return this;
  }

  fill(paint: Paint | number | string) {
    this.ops.push({ kind: "fill", paint: normalise(paint) });
    return this;
  }

  override render(ctx: CanvasRenderingContext2D) {
    if (!this.visible || this.alpha <= 0 || this.ops.length === 0) return;

    const scaled = this.scale.x !== 1 || this.scale.y !== 1;
    const shifted = this.position.x !== 0 || this.position.y !== 0;
    const transformed = shifted || scaled || this.alpha !== 1;
    if (transformed) {
      ctx.save();
      if (shifted) ctx.translate(this.position.x, this.position.y);
      if (scaled) ctx.scale(this.scale.x, this.scale.y);
      if (this.alpha !== 1) ctx.globalAlpha *= this.alpha;
    }

    ctx.beginPath();
    for (const op of this.ops) {
      switch (op.kind) {
        case "move":
          ctx.moveTo(op.x, op.y);
          break;
        case "line":
          ctx.lineTo(op.x, op.y);
          break;
        case "circle":
          ctx.moveTo(op.x + op.r, op.y);
          ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
          break;
        case "rect":
          ctx.rect(op.x, op.y, op.w, op.h);
          break;
        case "stroke": {
          const base = ctx.globalAlpha;
          if (op.paint.alpha !== undefined)
            ctx.globalAlpha = base * op.paint.alpha;
          ctx.lineWidth = op.paint.width ?? 1;
          ctx.lineCap = op.paint.cap ?? "butt";
          ctx.lineJoin = op.paint.join ?? "miter";
          ctx.strokeStyle = css(op.paint.color, "#fff");
          ctx.stroke();
          ctx.globalAlpha = base;
          ctx.beginPath();
          break;
        }
        case "fill": {
          const base = ctx.globalAlpha;
          if (op.paint.alpha !== undefined)
            ctx.globalAlpha = base * op.paint.alpha;
          ctx.fillStyle = css(op.paint.color, "#fff");
          ctx.fill();
          ctx.globalAlpha = base;
          ctx.beginPath();
          break;
        }
      }
    }

    if (transformed) ctx.restore();
  }
}
