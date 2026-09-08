/**
 * Axis-aligned bounds and box corners.
 * All values are in whichever space the caller supplies; nothing here knows
 * about screens or zoom.
 */

import type { Point } from "@/engine/coordinates";
import { applyToPoint, type Matrix } from "@/engine/geometry/matrix";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Corners = [Point, Point, Point, Point];

/** Corners of a local box (0,0)-(w,h) pushed through `matrix`: NW, NE, SE, SW. */
export function transformedCorners(
  width: number,
  height: number,
  matrix: Matrix,
): Corners {
  return [
    applyToPoint(matrix, { x: 0, y: 0 }),
    applyToPoint(matrix, { x: width, y: 0 }),
    applyToPoint(matrix, { x: width, y: height }),
    applyToPoint(matrix, { x: 0, y: height }),
  ];
}

export function boundsOfPoints(points: readonly Point[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
