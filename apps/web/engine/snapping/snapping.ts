/**
 * Smart snapping.
 *
 * Pure geometry over document coordinates: it takes the bounds being dragged
 * plus the bounds it may align to, and returns the offset to apply and the
 * guide lines to draw. Nothing here knows about React, pointers or the camera -
 * the caller converts the screen-space threshold into document units.
 */

import type { Bounds } from "@/engine/geometry/bounds";

/** Snap distance in screen pixels; divided by zoom to reach document units. */
export const SNAP_THRESHOLD_PX = 6;

export type SnapAxis = "x" | "y";

export interface SnapGuide {
  axis: SnapAxis;
  /** Document coordinate of the guide line. */
  position: number;
  /** Span the line is drawn across, in document units. */
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

interface Candidate {
  /** Position of the line being matched. */
  position: number;
  /** Span of the object that produced the line. */
  start: number;
  end: number;
}

/** The three alignment lines an object offers along one axis. */
function edgesAlong(bounds: Bounds, axis: SnapAxis): number[] {
  return axis === "x"
    ? [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width]
    : [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
}

function spanAcross(bounds: Bounds, axis: SnapAxis): [number, number] {
  return axis === "x"
    ? [bounds.y, bounds.y + bounds.height]
    : [bounds.x, bounds.x + bounds.width];
}

function candidatesFor(
  axis: SnapAxis,
  canvas: Bounds,
  others: readonly Bounds[],
): Candidate[] {
  const candidates: Candidate[] = [];

  const [canvasStart, canvasEnd] = spanAcross(canvas, axis);
  for (const position of edgesAlong(canvas, axis)) {
    candidates.push({ position, start: canvasStart, end: canvasEnd });
  }

  for (const bounds of others) {
    const [start, end] = spanAcross(bounds, axis);
    for (const position of edgesAlong(bounds, axis)) {
      candidates.push({ position, start, end });
    }
  }

  return candidates;
}

interface AxisSnap {
  offset: number;
  /** Candidates the object lines up with once the offset is applied. */
  matches: Candidate[];
}

function snapAxis(
  moving: Bounds,
  axis: SnapAxis,
  candidates: readonly Candidate[],
  threshold: number,
): AxisSnap {
  const movingEdges = edgesAlong(moving, axis);

  let best: { distance: number; offset: number } | null = null;
  for (const candidate of candidates) {
    for (const edge of movingEdges) {
      const distance = Math.abs(candidate.position - edge);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) {
        best = { distance, offset: candidate.position - edge };
      }
    }
  }

  if (!best) return { offset: 0, matches: [] };
  const offset = best.offset;

  // Every candidate the snapped object now touches becomes a visible guide.
  const snapped = movingEdges.map((edge) => edge + offset);
  const matches: Candidate[] = [];
  for (const candidate of candidates) {
    if (!snapped.some((edge) => Math.abs(edge - candidate.position) < 0.01)) {
      continue;
    }
    if (matches.some((match) => match.position === candidate.position)) continue;
    matches.push(candidate);
  }

  return { offset, matches };
}

/**
 * Builds guide lines once both axes are resolved, so a guide's span reflects
 * where the object actually lands rather than a half-applied offset.
 */
function guidesFor(
  axis: SnapAxis,
  matches: readonly Candidate[],
  moved: Bounds,
): SnapGuide[] {
  const [start, end] = spanAcross(moved, axis);
  return matches.map((match) => ({
    axis,
    position: match.position,
    start: Math.min(match.start, start),
    end: Math.max(match.end, end),
  }));
}

/**
 * Finds the offset that aligns `moving` with the canvas or another object.
 *
 * The result is an adjustment to apply to the in-progress drag; the element is
 * only changed when the user actually moves it, so snapping never modifies the
 * document on its own.
 */
export function calculateSnap(
  moving: Bounds,
  others: readonly Bounds[],
  canvas: Bounds,
  threshold: number,
): SnapResult {
  if (threshold <= 0) return NO_SNAP;

  const x = snapAxis(moving, "x", candidatesFor("x", canvas, others), threshold);
  const y = snapAxis(moving, "y", candidatesFor("y", canvas, others), threshold);

  const moved: Bounds = {
    ...moving,
    x: moving.x + x.offset,
    y: moving.y + y.offset,
  };

  return {
    dx: x.offset,
    dy: y.offset,
    guides: [
      ...guidesFor("x", x.matches, moved),
      ...guidesFor("y", y.matches, moved),
    ],
  };
}

/** Snap threshold in document units for the current zoom. */
export function snapThresholdFor(zoom: number): number {
  return SNAP_THRESHOLD_PX / zoom;
}
