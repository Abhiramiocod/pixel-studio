/**
 * Element transforms: where an element sits in the world, and what a move,
 * resize or rotation does to it.
 *
 * An element's box is stored in its **parent's content space**, so gestures are
 * computed there too: convert the pointer from document space into the parent's
 * space once, and the same maths works for a top-level shape, a child of a
 * rotated group, and anything nested deeper.
 *
 * The `zoom` arguments exist only so selection handles keep a constant screen
 * size; they never influence stored geometry.
 */

import {
  childrenOf,
  isContainer,
  type DesignElement,
} from "@/models/elements";
import { locateElement, type DesignDocument } from "@/models/design";
import type { Point } from "@/engine/coordinates";
import {
  IDENTITY,
  applyToPoint,
  invert,
  multiply,
  multiplyAll,
  rotation as rotationMatrix,
  translation,
  type Matrix,
} from "@/engine/geometry/matrix";
import {
  boundsOfPoints,
  transformedCorners,
  type Bounds,
  type Corners,
} from "@/engine/geometry/bounds";

export type HandleId = "nw" | "ne" | "se" | "sw" | "rotate";

export const CORNER_HANDLES: readonly Exclude<HandleId, "rotate">[] = [
  "nw",
  "ne",
  "se",
  "sw",
];

/** Handle box size in screen pixels. */
export const HANDLE_SIZE = 10;

/** Distance from the top edge to the rotation handle, in screen pixels. */
export const ROTATION_HANDLE_DISTANCE = 28;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Centre of the element's box, in its parent's content space. */
export function elementCenter(element: DesignElement): Point {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
}

export function rotatePoint(
  point: Point,
  origin: Point,
  degrees: number,
): Point {
  const radians = toRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Maps the element's content space (origin at its top-left, unrotated) into its
 * parent's content space.
 */
export function localMatrix(element: DesignElement): Matrix {
  const cx = element.width / 2;
  const cy = element.height / 2;
  return multiplyAll([
    translation(element.x + cx, element.y + cy),
    rotationMatrix(element.rotation),
    translation(-cx, -cy),
  ]);
}

/** Document space <- the content space of `id`'s parent. */
export function parentMatrix(doc: DesignDocument, id: string): Matrix {
  const location = locateElement(doc, id);
  if (!location) return IDENTITY;
  return multiplyAll(location.ancestors.map(localMatrix));
}

/** Document space <- the content space of `id` itself. */
export function worldMatrix(doc: DesignDocument, id: string): Matrix {
  const location = locateElement(doc, id);
  if (!location) return IDENTITY;
  return multiply(
    multiplyAll(location.ancestors.map(localMatrix)),
    localMatrix(location.element),
  );
}

/** Converts a document-space point into the content space of `id`'s parent. */
export function toParentSpace(
  doc: DesignDocument,
  id: string,
  point: Point,
): Point {
  return applyToPoint(invert(parentMatrix(doc, id)), point);
}

/** Converts a document-space point into the element's own content space. */
export function toElementSpace(
  doc: DesignDocument,
  id: string,
  point: Point,
): Point {
  return applyToPoint(invert(worldMatrix(doc, id)), point);
}

/** Converts a document-space delta into `id`'s parent space (rotation only). */
export function toParentDelta(
  doc: DesignDocument,
  id: string,
  delta: Point,
): Point {
  const inverse = invert(parentMatrix(doc, id));
  const origin = applyToPoint(inverse, { x: 0, y: 0 });
  const moved = applyToPoint(inverse, delta);
  return { x: moved.x - origin.x, y: moved.y - origin.y };
}

/** The element's four corners in document space: NW, NE, SE, SW. */
export function elementCorners(
  doc: DesignDocument,
  element: DesignElement,
): Corners {
  return transformedCorners(
    element.width,
    element.height,
    worldMatrix(doc, element.id),
  );
}

/** Axis-aligned document-space bounds of a single element. */
export function elementBounds(
  doc: DesignDocument,
  element: DesignElement,
): Bounds {
  return (
    boundsOfPoints(elementCorners(doc, element)) ?? {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    }
  );
}

/** Bounds of an element including everything nested inside it. */
export function subtreeBounds(
  doc: DesignDocument,
  element: DesignElement,
): Bounds {
  const points: Point[] = [...elementCorners(doc, element)];
  if (isContainer(element)) {
    for (const child of childrenOf(element)) {
      const bounds = subtreeBounds(doc, child);
      points.push(
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      );
    }
  }
  return boundsOfPoints(points) ?? elementBounds(doc, element);
}

/** Handle positions in document space. */
export function handlePositions(
  doc: DesignDocument,
  element: DesignElement,
  zoom: number,
): Record<HandleId, Point> {
  const matrix = worldMatrix(doc, element.id);
  const [nw, ne, se, sw] = transformedCorners(
    element.width,
    element.height,
    matrix,
  );
  return {
    nw,
    ne,
    se,
    sw,
    rotate: applyToPoint(matrix, {
      x: element.width / 2,
      y: -ROTATION_HANDLE_DISTANCE / zoom,
    }),
  };
}

/** The handle under a document-space point, or null. */
export function hitTestHandle(
  doc: DesignDocument,
  element: DesignElement,
  point: Point,
  zoom: number,
): HandleId | null {
  const tolerance = HANDLE_SIZE / zoom;
  const positions = handlePositions(doc, element, zoom);
  const ids: HandleId[] = ["rotate", ...CORNER_HANDLES];

  for (const id of ids) {
    const handle = positions[id];
    if (
      Math.abs(point.x - handle.x) <= tolerance &&
      Math.abs(point.y - handle.y) <= tolerance
    ) {
      return id;
    }
  }
  return null;
}

function oppositeCorner(
  handle: Exclude<HandleId, "rotate">,
): Exclude<HandleId, "rotate"> {
  switch (handle) {
    case "nw":
      return "se";
    case "ne":
      return "sw";
    case "se":
      return "nw";
    case "sw":
      return "ne";
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The element's own corners in its parent's space (before any resize). */
function parentSpaceCorners(element: DesignElement): Record<
  Exclude<HandleId, "rotate">,
  Point
> {
  const matrix = localMatrix(element);
  const [nw, ne, se, sw] = transformedCorners(
    element.width,
    element.height,
    matrix,
  );
  return { nw, ne, se, sw };
}

/**
 * Resizes by dragging a corner to `point` (in the element's parent space),
 * keeping the opposite corner pinned and respecting the element's rotation.
 */
export function resizeElement(
  element: DesignElement,
  handle: Exclude<HandleId, "rotate">,
  point: Point,
  minSize: number,
): Rect {
  const anchor = parentSpaceCorners(element)[oppositeCorner(handle)];
  // Pointer in the element's unrotated frame, relative to the pinned corner.
  const local = rotatePoint(point, anchor, -element.rotation);
  const signX = handle === "ne" || handle === "se" ? 1 : -1;
  const signY = handle === "se" || handle === "sw" ? 1 : -1;

  const width = Math.max(minSize, signX * (local.x - anchor.x));
  const height = Math.max(minSize, signY * (local.y - anchor.y));

  const center = rotatePoint(
    { x: anchor.x + (signX * width) / 2, y: anchor.y + (signY * height) / 2 },
    anchor,
    element.rotation,
  );

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

/** Angle of `point` (parent space) seen from the element centre; 0 = handle up. */
export function pointerAngle(element: DesignElement, point: Point): number {
  const center = elementCenter(element);
  return toDegrees(Math.atan2(point.y - center.y, point.x - center.x)) + 90;
}

/* ------------------------------------------------------------------ *
 * Scaling a container's contents
 * ------------------------------------------------------------------ */

/** Geometry of one descendant at the moment a gesture started. */
export interface DescendantSnapshot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Present for text, so type scales with the group. */
  fontSize: number | null;
}

export function captureDescendants(
  element: DesignElement,
): DescendantSnapshot[] {
  const snapshot: DescendantSnapshot[] = [];
  const visit = (current: DesignElement) => {
    snapshot.push({
      id: current.id,
      x: current.x,
      y: current.y,
      width: current.width,
      height: current.height,
      fontSize: current.type === "text" ? current.style.fontSize : null,
    });
    for (const child of childrenOf(current)) visit(child);
  };
  for (const child of childrenOf(element)) visit(child);
  return snapshot;
}

export interface ScaledChange {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number | null;
}

/**
 * Scales captured descendants by the factors a container was resized with.
 *
 * Every descendant scales, not only direct children: a container's content
 * space is never itself scaled (transforms are rigid), so each level has to
 * carry the factor through for nested layouts to stay proportional.
 */
export function scaleDescendants(
  snapshot: readonly DescendantSnapshot[],
  scaleX: number,
  scaleY: number,
  minSize: number,
): ScaledChange[] {
  // Type scales with the overall area change so it stays visually proportional.
  const fontScale = Math.sqrt(Math.abs(scaleX * scaleY));

  return snapshot.map((item) => ({
    id: item.id,
    x: item.x * scaleX,
    y: item.y * scaleY,
    width: Math.max(minSize, item.width * scaleX),
    height: Math.max(minSize, item.height * scaleY),
    fontSize: item.fontSize === null ? null : item.fontSize * fontScale,
  }));
}
