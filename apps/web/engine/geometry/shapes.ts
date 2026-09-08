/**
 * Shape geometry: the vertices each shape kind is built from.
 *
 * Rendering and hit-testing both read from here, so a polygon can never be
 * drawn one way and picked another.
 */

import type {
  NormalizedPoint,
  ShapeGeometry,
} from "@pixel-studio/types";
import type { Point } from "@/engine/coordinates";

/** Point in element-local coordinates from a normalised (0..1) point. */
export function denormalize(
  point: NormalizedPoint,
  width: number,
  height: number,
): Point {
  return { x: point.x * width, y: point.y * height };
}

/**
 * Outline vertices in element-local coordinates, or null for shapes that are
 * not polygons (ellipse, and the stroked line/arrow kinds).
 */
export function shapeVertices(
  geometry: ShapeGeometry,
  width: number,
  height: number,
): Point[] | null {
  switch (geometry.kind) {
    case "rectangle":
      return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
    case "triangle":
      return [
        { x: width / 2, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
    case "polygon":
      return regularPolygon(Math.max(3, geometry.sides), width, height);
    case "star":
      return starPolygon(
        Math.max(3, geometry.points),
        Math.min(0.95, Math.max(0.05, geometry.innerRatio)),
        width,
        height,
      );
    case "ellipse":
    case "line":
    case "arrow":
      return null;
  }
}

/** Inscribed regular polygon with the first vertex at the top. */
export function regularPolygon(
  sides: number,
  width: number,
  height: number,
): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const points: Point[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push({
      x: cx + Math.cos(angle) * cx,
      y: cy + Math.sin(angle) * cy,
    });
  }
  return points;
}

/** Star with `points` tips, alternating outer and inner vertices. */
export function starPolygon(
  points: number,
  innerRatio: number,
  width: number,
  height: number,
): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const vertices: Point[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? 1 : innerRatio;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    vertices.push({
      x: cx + Math.cos(angle) * cx * radius,
      y: cy + Math.sin(angle) * cy * radius,
    });
  }
  return vertices;
}

export function pointInPolygon(
  polygon: readonly Point[],
  point: Point,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInEllipse(
  point: Point,
  width: number,
  height: number,
): boolean {
  const rx = width / 2;
  const ry = height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (point.x - rx) / rx;
  const dy = (point.y - ry) / ry;
  return dx * dx + dy * dy <= 1;
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.min(
    1,
    Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Hit test in element-local coordinates. `tolerance` widens stroked shapes. */
export function hitTestShape(
  geometry: ShapeGeometry,
  width: number,
  height: number,
  point: Point,
  tolerance: number,
): boolean {
  switch (geometry.kind) {
    case "ellipse":
      return pointInEllipse(point, width, height);
    case "line":
    case "arrow": {
      const start = denormalize(geometry.start, width, height);
      const end = denormalize(geometry.end, width, height);
      return distanceToSegment(point, start, end) <= tolerance;
    }
    default: {
      const vertices = shapeVertices(geometry, width, height);
      return vertices ? pointInPolygon(vertices, point) : false;
    }
  }
}
