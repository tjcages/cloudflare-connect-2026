/** Mutable outgoing pulse gate: finite budget per layer-source icon-box. */
export type OutgoingPulseGateState = {
  active: Set<string>;
  waiting: Set<string>;
};

export const createOutgoingPulseGateState = (): OutgoingPulseGateState => ({
  active: new Set(),
  waiting: new Set(),
});

/**
 * Try to acquire an outgoing animation slot for `connectorId`.
 * `orderedIds` is stable document order for fair promotion from `waiting`.
 */
export const tryAcquireOutgoingPulseSlot = (
  _orderedIds: string[],
  budget: number,
  connectorId: string,
  state: OutgoingPulseGateState,
): { granted: boolean; state: OutgoingPulseGateState } => {
  if (!Number.isFinite(budget)) {
    return { granted: true, state };
  }
  if (budget <= 0) {
    return { granted: false, state };
  }
  if (state.active.has(connectorId)) {
    return { granted: true, state };
  }
  if (state.active.size < budget) {
    const next = createOutgoingPulseGateState();
    next.active = new Set(state.active);
    next.active.add(connectorId);
    next.waiting = new Set(state.waiting);
    return { granted: true, state: next };
  }
  const next = createOutgoingPulseGateState();
  next.active = new Set(state.active);
  next.waiting = new Set(state.waiting);
  next.waiting.add(connectorId);
  return { granted: false, state: next };
};

const promoteWaiting = (
  orderedIds: string[],
  budget: number,
  state: OutgoingPulseGateState,
): OutgoingPulseGateState => {
  const next = createOutgoingPulseGateState();
  next.active = new Set(state.active);
  next.waiting = new Set(state.waiting);
  if (!Number.isFinite(budget) || budget <= 0) {
    return next;
  }
  while (next.active.size < budget) {
    let promoted: string | undefined;
    for (const id of orderedIds) {
      if (next.waiting.has(id)) {
        promoted = id;
        break;
      }
    }
    if (!promoted) {
      break;
    }
    next.waiting.delete(promoted);
    next.active.add(promoted);
  }
  return next;
};

export const releaseOutgoingPulseSlot = (
  orderedIds: string[],
  budget: number,
  connectorId: string,
  state: OutgoingPulseGateState,
): OutgoingPulseGateState => {
  if (!Number.isFinite(budget)) {
    return state;
  }
  const next = createOutgoingPulseGateState();
  next.active = new Set(state.active);
  next.waiting = new Set(state.waiting);
  next.active.delete(connectorId);
  return promoteWaiting(orderedIds, budget, next);
};

/** When budget drops to 0 (presentation off), clear slots — callers stop animations separately. */
export const resetOutgoingPulseGate = (): OutgoingPulseGateState => createOutgoingPulseGateState();
