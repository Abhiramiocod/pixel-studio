/**
 * Generic undo/redo stack.
 *
 * Deliberately knows nothing about the design document or React: it stores
 * batches of opaque operations and hands them back for the caller to apply or
 * invert. That keeps the history testable and reusable.
 */

export interface HistoryEntry<Op> {
  /** Human-readable name, e.g. "Move element". */
  label: string;
  ops: Op[];
  /**
   * Groups a continuous interaction (a drag, a slider) into one undo step.
   * Consecutive entries sharing a session id are merged.
   */
  sessionId: string | null;
}

export interface History<Op> {
  past: HistoryEntry<Op>[];
  future: HistoryEntry<Op>[];
}

export const HISTORY_LIMIT = 100;

export function createHistory<Op>(): History<Op> {
  return { past: [], future: [] };
}

export function canUndo<Op>(history: History<Op>): boolean {
  return history.past.length > 0;
}

export function canRedo<Op>(history: History<Op>): boolean {
  return history.future.length > 0;
}

/**
 * Appends an entry. Recording always clears the redo branch, so a new change
 * after an undo correctly invalidates what was undone.
 *
 * `merge` may fold the incoming ops into the previous entry (returning the
 * combined ops) when both belong to the same session; return null to refuse.
 */
export function record<Op>(
  history: History<Op>,
  entry: HistoryEntry<Op>,
  merge?: (previous: Op[], next: Op[]) => Op[] | null,
): History<Op> {
  const previous = history.past.at(-1);

  if (
    merge &&
    previous &&
    entry.sessionId !== null &&
    previous.sessionId === entry.sessionId
  ) {
    const merged = merge(previous.ops, entry.ops);
    if (merged) {
      return {
        past: [...history.past.slice(0, -1), { ...previous, ops: merged }],
        future: [],
      };
    }
  }

  const past = [...history.past, entry];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past,
    future: [],
  };
}

export interface HistoryStep<Op> {
  history: History<Op>;
  entry: HistoryEntry<Op>;
}

/** Pops the last entry; the caller applies its *inverted* ops. */
export function undo<Op>(history: History<Op>): HistoryStep<Op> | null {
  const entry = history.past.at(-1);
  if (!entry) return null;
  return {
    entry,
    history: {
      past: history.past.slice(0, -1),
      future: [entry, ...history.future],
    },
  };
}

/** Pops the next redo entry; the caller re-applies its ops as recorded. */
export function redo<Op>(history: History<Op>): HistoryStep<Op> | null {
  const [entry, ...rest] = history.future;
  if (!entry) return null;
  return {
    entry,
    history: { past: [...history.past, entry], future: rest },
  };
}
