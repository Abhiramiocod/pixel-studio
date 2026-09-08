/**
 * Alignment and distribution.
 *
 * Everything is computed in document coordinates over axis-aligned bounds, and
 * returned as offsets for the caller to turn into document operations. No
 * screen coordinates, no React.
 */

import type { Bounds } from "@/engine/geometry/bounds";

export type AlignMode =
  | "left"
  | "center-horizontal"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

export interface AlignTarget {
  id: string;
  bounds: Bounds;
}

export interface Offset {
  id: string;
  dx: number;
  dy: number;
}

/** Offsets that align every target to `reference`. */
export function alignElements(
  targets: readonly AlignTarget[],
  reference: Bounds,
  mode: AlignMode,
): Offset[] {
  return targets
    .map(({ id, bounds }) => {
      switch (mode) {
        case "left":
          return { id, dx: reference.x - bounds.x, dy: 0 };
        case "center-horizontal":
          return {
            id,
            dx:
              reference.x +
              reference.width / 2 -
              (bounds.x + bounds.width / 2),
            dy: 0,
          };
        case "right":
          return {
            id,
            dx: reference.x + reference.width - (bounds.x + bounds.width),
            dy: 0,
          };
        case "top":
          return { id, dx: 0, dy: reference.y - bounds.y };
        case "middle":
          return {
            id,
            dx: 0,
            dy:
              reference.y +
              reference.height / 2 -
              (bounds.y + bounds.height / 2),
          };
        case "bottom":
          return {
            id,
            dx: 0,
            dy: reference.y + reference.height - (bounds.y + bounds.height),
          };
      }
    })
    .filter((offset) => offset.dx !== 0 || offset.dy !== 0);
}

/**
 * Offsets that leave equal gaps between the targets, keeping the outermost two
 * where they are. Needs at least three elements to mean anything.
 */
export function distributeElements(
  targets: readonly AlignTarget[],
  axis: DistributeAxis,
): Offset[] {
  if (targets.length < 3) return [];

  const horizontal = axis === "horizontal";
  const start = (bounds: Bounds) => (horizontal ? bounds.x : bounds.y);
  const size = (bounds: Bounds) => (horizontal ? bounds.width : bounds.height);

  const sorted = [...targets].sort(
    (a, b) => start(a.bounds) - start(b.bounds),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const span =
    start(last.bounds) + size(last.bounds) - start(first.bounds);
  const occupied = sorted.reduce(
    (total, target) => total + size(target.bounds),
    0,
  );
  const gap = (span - occupied) / (sorted.length - 1);

  const offsets: Offset[] = [];
  let cursor = start(first.bounds) + size(first.bounds) + gap;

  for (let i = 1; i < sorted.length - 1; i += 1) {
    const target = sorted[i];
    const delta = cursor - start(target.bounds);
    if (delta !== 0) {
      offsets.push({
        id: target.id,
        dx: horizontal ? delta : 0,
        dy: horizontal ? 0 : delta,
      });
    }
    cursor += size(target.bounds) + gap;
  }

  return offsets;
}
