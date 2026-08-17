import type { Application, Container } from "pixi.js";
import type { IProductsBox } from "../../box/types";
import {
  boxRect,
  buildDirectedEdges,
  type Edge,
  edgeKey,
  findRoots,
} from "../utils/geometry";
import {
  createOrbitSnake,
  roundedRectShape,
} from "@/components/_animations/shared/orbit-snake/create-orbit-snake";
import { PRODUCTS } from "@/components/_animations/shared/orbit-snake/profiles";
import { augmentWithEdges } from "./edge";
import { boxNudgeX } from "./box-nudge";
import { createPulse, type Pulse } from "./pulse";
import { DURATION } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import { revealBoxLabel, revealConnectorBadge, rippleBoxLabel } from "./reveal";
import { cubicBezier } from "motion";

const INNER_INSET = 12;
const INNER_RADIUS = 10;
const BUILD_PER_FRAME = 2;
// Matches the 0.35 hold stop on the solid edge gradient: the remaining 65% is
// where the line fades, so that is where the snake fades too.
const EDGE_FADE = 0.65;

export type PulseOptions = {
  /** "solid" edge connectors fade along their length, so their snakes have to
   * fade with them rather than running past where the line has vanished. */
  edgeStyle?: "dashed" | "solid";
  /** Throw along the connectors that run off to the canvas edge. Off keeps
   * those lines as static decoration, so a run starts and ends on a box
   * instead of travelling in and out of the card. */
  edgeThrows?: boolean;
  canvasWidth?: number;
  /** Seconds a snake takes to cross one connector. Shortening it shortens the
   * whole chain, which is what sets how often a group can throw again. */
  duration?: number;
  /** Seconds before a snake lands that the next hop is thrown. Tightens the
   * relay at each box without changing how fast a snake travels. Negative
   * values hold the box that long before throwing on. */
  handoff?: number;
  /** Cubic-bezier control points for the travel curve, as numbers so this can
   * cross the island prop boundary. Flatter curves glide, S-curves lurch. */
  ease?: [number, number, number, number];
  /** Seconds a lane group waits after its snake exits before throwing the next.
   * Ignored when `spawn` is set. */
  gap?: [min: number, max: number];
  /** Throw on this interval instead of waiting for the chain to drain, so a
   * group runs several snakes at once. Clamped to `duration`: below that a new
   * snake would restart a connector its predecessor is still crossing. Assumes
   * the lanes in a group are the same number of hops long, so snakes reach a
   * shared connector in the same order they were thrown. */
  spawn?: [min: number, max: number];
  /** Seconds each successive lane group offsets its first throw by. */
  stagger?: number;
};

type Group = {
  roots: string[];
  nodes: Set<string>;
  /** Every connector the group can throw down, for the stalled-chain watchdog. */
  edgeKeys: string[];
  leavesByRoot: Map<string, Set<string>>;
  active: string | null;
  last: string | null;
  pending: Set<string>;
  nextAt: number;
};

function buildPulseGraph(boxes: IProductsBox[]) {
  const edges = buildDirectedEdges(boxes);

  const outgoing = new Map<string, Edge<IProductsBox>[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source.id) ?? [];
    list.push(edge);
    outgoing.set(edge.source.id, list);
  }

  const leaves = new Set(
    boxes
      .filter((b) => (outgoing.get(b.id)?.length ?? 0) === 0)
      .map((b) => b.id)
  );

  const roots = findRoots(boxes).filter((id) => !leaves.has(id));

  return { edges, roots, outgoing, leaves };
}

function reachableFrom(
  rootId: string,
  outgoing: Map<string, Edge<IProductsBox>[]>
): Set<string> {
  const seen = new Set([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    for (const edge of outgoing.get(stack.pop()!) ?? []) {
      if (seen.has(edge.target.id)) continue;
      seen.add(edge.target.id);
      stack.push(edge.target.id);
    }
  }
  return seen;
}

function intersects(a: Set<string>, b: Set<string>) {
  for (const id of a) if (b.has(id)) return true;
  return false;
}

// Roots whose downstream paths touch a shared node also share connectors, so
// they have to take turns — replaying a connector mid-throw would snap its
// snake back to the start. Independent lanes get their own group and run
// concurrently.
function buildGroups(
  roots: string[],
  outgoing: Map<string, Edge<IProductsBox>[]>,
  leaves: Set<string>,
  stagger: number
): Group[] {
  const reachByRoot = new Map(
    roots.map((root) => [root, reachableFrom(root, outgoing)])
  );

  const groups: Group[] = [];
  for (const root of roots) {
    const group: Group = {
      roots: [root],
      nodes: new Set(reachByRoot.get(root)),
      edgeKeys: [],
      leavesByRoot: new Map(),
      active: null,
      last: null,
      pending: new Set(),
      nextAt: 0,
    };

    for (let i = groups.length - 1; i >= 0; i--) {
      if (!intersects(groups[i].nodes, group.nodes)) continue;
      group.roots.unshift(...groups[i].roots);
      for (const id of groups[i].nodes) group.nodes.add(id);
      groups.splice(i, 1);
    }

    groups.push(group);
  }

  for (const [index, group] of groups.entries()) {
    group.nextAt = index * stagger;
    for (const id of group.nodes) {
      for (const edge of outgoing.get(id) ?? [])
        group.edgeKeys.push(edgeKey(edge));
    }
    for (const root of group.roots) {
      const reached = reachByRoot.get(root) ?? new Set<string>();
      group.leavesByRoot.set(
        root,
        new Set([...reached].filter((id) => leaves.has(id)))
      );
    }
  }

  return groups;
}

export function createPulseAnimation(
  boxes: IProductsBox[],
  layer: Container,
  app: Application,
  cleanup: (fn: () => void) => void,
  {
    edgeStyle = "dashed",
    edgeThrows = true,
    canvasWidth,
    duration,
    handoff,
    ease,
    gap = [0, 0],
    spawn,
    stagger = 0,
  }: PulseOptions = {}
): { tick(elapsed: number): void } {
  const hop = duration ?? DURATION;
  const easeFn = ease && cubicBezier(...ease);
  const spawnEvery =
    spawn && ([Math.max(spawn[0], hop), Math.max(spawn[1], hop)] as const);
  const roll = ([min, max]: readonly [number, number]) =>
    min + Math.random() * (max - min);

  const { nodes, synthIds } = edgeThrows
    ? augmentWithEdges(boxes, canvasWidth)
    : { nodes: boxes, synthIds: new Set<string>() };
  const { edges, roots, outgoing, leaves } = buildPulseGraph(nodes);

  const groups = buildGroups(roots, outgoing, leaves, stagger);
  const groupOfNode = new Map<string, Group>();
  for (const group of groups) {
    for (const id of group.nodes) groupOfNode.set(id, group);
  }

  const pulses = new Map<string, Pulse>();
  // Queued per connector, not one slot per connector: two chains can pile up on
  // a shared connector, and keeping only the newest would drop the older one.
  // Arrival rate is bounded by `spawn >= duration`, so these drain rather than
  // grow without limit.
  const deferred = new Map<
    string,
    { edge: Edge<IProductsBox>; onThrow?: () => void }[]
  >();
  const orbits = new Map<string, ReturnType<typeof createOrbitSnake>>();
  cleanup(() => {
    for (const orbit of orbits.values()) orbit.destroy();
  });

  const buildQueue: (() => void)[] = [];
  for (const edge of edges) {
    buildQueue.push(() => {
      pulses.set(
        edgeKey(edge),
        createPulse(layer, edge.source, edge.target, {
          ring: !synthIds.has(edge.target.id),
          duration,
          handoff,
          ease: easeFn,
          fadeSourceFraction:
            edgeStyle === "solid" && synthIds.has(edge.source.id)
              ? EDGE_FADE
              : undefined,
          fadeTargetFraction:
            edgeStyle === "solid" && synthIds.has(edge.target.id)
              ? EDGE_FADE
              : undefined,
        })
      );
    });
  }
  for (const box of boxes) {
    buildQueue.push(() => {
      const rect = boxRect(box);
      const inner = document
        .getElementById(box.id)
        ?.querySelector<HTMLElement>("[data-box-inner]");
      const orbit = createOrbitSnake(app, {
        shape: roundedRectShape(
          rect.left + INNER_INSET,
          rect.top + INNER_INSET,
          rect.width - 2 * INNER_INSET,
          rect.bottom - rect.top - 2 * INNER_INSET,
          INNER_RADIUS
        ),
        color: box.color,
        profile: PRODUCTS,
        taper: "center",
        parent: layer,
        nudgeX: inner ? () => boxNudgeX.get(inner) ?? 0 : undefined,
      });
      orbits.set(box.id, orbit);
    });
  }
  let built = buildQueue.length === 0;

  const activatedCycle = new Map<string, number>();
  let cycle = 0;

  function activate(boxId: string) {
    if (activatedCycle.has(boxId)) return;
    activatedCycle.set(boxId, cycle);
    activateBox(boxId);
    revealBoxLabel(boxId);
  }

  function playEdge(edge: Edge<IProductsBox>, onThrow?: () => void) {
    pulses.get(edgeKey(edge))?.play({
      onThrow,
      onHandoff: () => throwFrom(edge.target.id),
      onPass: () => revealConnectorBadge(edge.target.id),
      onArrive: () => arrive(edge.target.id),
    });
  }

  // A connector carries one snake at a time, and replaying it mid-throw would
  // snap that snake back to the start. Hold the hop until the connector frees
  // instead of skipping it: the chain still reaches its container, it just
  // waits at the box for a moment. Dropping it would make a snake vanish
  // mid-card with nothing to show why.
  function throwFrom(boxId: string, onThrow?: () => void): boolean {
    let queued = false;
    for (const edge of outgoing.get(boxId) ?? []) {
      const key = edgeKey(edge);
      const pulse = pulses.get(key);
      if (!pulse) continue;
      if (pulse.busy) {
        const queue = deferred.get(key);
        if (queue) queue.push({ edge, onThrow });
        else deferred.set(key, [{ edge, onThrow }]);
      } else {
        playEdge(edge, onThrow);
      }
      queued = true;
    }
    return queued;
  }

  // One hop per connector per flush — playing it makes the connector busy again,
  // so anything still queued behind it waits for a later frame.
  function flushDeferred() {
    for (const [key, queue] of deferred) {
      if (pulses.get(key)?.busy) continue;
      const held = queue.shift();
      if (queue.length === 0) deferred.delete(key);
      if (held) playEdge(held.edge, held.onThrow);
    }
  }

  function groupBusy(group: Group) {
    return group.edgeKeys.some((key) => pulses.get(key)?.busy);
  }

  function throwGroup(group: Group) {
    const choices =
      group.roots.length > 1
        ? group.roots.filter((id) => id !== group.last)
        : group.roots;
    const root = choices[Math.floor(Math.random() * choices.length)];

    // A busy root connector means nothing was thrown. Commit no state, so the
    // next frame retries instead of arming a drain gate that never clears.
    const thrown = throwFrom(root, () => reactAt(root));
    if (!thrown) return;

    cycle++;
    group.last = root;

    // `active` doubles as the drain gate: spawn mode leaves it null so the
    // group re-throws purely on its interval.
    if (spawnEvery) {
      group.nextAt = elapsed + roll(spawnEvery);
    } else {
      group.active = root;
      group.pending = new Set(group.leavesByRoot.get(root));
    }
  }

  // A box reacting to a snake: on arrival for most, but the box a run starts
  // from reacts as it throws, since nothing ever arrives there.
  function reactAt(boxId: string) {
    dispatchPulse(boxId);
    activate(boxId);
    if ((activatedCycle.get(boxId) ?? cycle) < cycle) rippleBoxLabel(boxId);
    orbits.get(boxId)?.play();
  }

  function arrive(boxId: string) {
    reactAt(boxId);

    // The onward throw already went out on the handoff; this only closes the
    // group's drain gate once the run reaches its last box.
    if ((outgoing.get(boxId)?.length ?? 0) === 0) {
      const group = groupOfNode.get(boxId);
      if (group?.active) {
        group.pending.delete(boxId);
        if (group.pending.size === 0) {
          group.active = null;
          group.nextAt = elapsed + roll(gap);
        }
      }
    }
  }

  let elapsed = 0;

  return {
    tick(t: number) {
      elapsed = t;
      if (!built) {
        for (let i = 0; i < BUILD_PER_FRAME && buildQueue.length > 0; i++) {
          buildQueue.shift()?.();
        }
        if (buildQueue.length === 0) built = true;
        return;
      }
      // Before the watchdog samples busyness, so a connector that just freed is
      // re-armed and its group never looks idle mid-chain.
      flushDeferred();
      for (const group of groups) {
        // Normally the leaf arrival clears the gate while the last connector is
        // still running, so this only catches a chain that died early — a hop
        // that could not be re-thrown at all would otherwise strand it.
        if (group.active !== null && !groupBusy(group)) {
          group.active = null;
          group.nextAt = elapsed + roll(gap);
          continue;
        }
        if (group.active === null && elapsed >= group.nextAt) throwGroup(group);
      }
      for (const pulse of pulses.values()) pulse.update(elapsed);
    },
  };
}

function dispatchPulse(id: string) {
  document
    .getElementById(id)
    ?.dispatchEvent(new CustomEvent("product-pulse-arrive"));
}

function activateBox(id: string) {
  document.getElementById(id)?.setAttribute("data-active", "");
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-box="${id}"]`
  )) {
    el.setAttribute("data-active", "");
  }
}
