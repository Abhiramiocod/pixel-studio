/**
 * Geometry helpers for hit-testing and transforms.
 * Pure functions over the design model - no canvas, no React.
 *
 * `zoom` parameters exist so handles keep a constant *screen* size: a handle is
 * `HANDLE_SIZE / zoom` document units across, which keeps hit areas usable at
 * every zoom level.
 */

import { MIN_ELEMENT_SIZE, type DesignElement } from "@/models/design";
import type { Point } from "@/engine/coordinates";

/** Corner handles plus the rotation handle. */
export type HandleId = "nw" | "ne" | "se" | "sw" | "rotate";

export const CORNER_HANDLES: readonly HandleId[] = ["nw", "ne", "se", "sw"];

/** Handle box size in *screen* pixels; divided by zoom when used in document space. */
export const HANDLE_SIZE = 10;

/** Distance from the top edge to the rotation handle, in screen pixels. */
export const ROTATION_HANDLE_DISTANCE = 28;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Normalises to the [0, 360) range. */
export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

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

/** Maps a document-space point into the element's unrotated frame. */
export function toElementLocal(element: DesignElement, point: Point): Point {
  return rotatePoint(point, elementCenter(element), -element.rotation);
}

export function hitTestElement(element: DesignElement, point: Point): boolean {
  const local = toElementLocal(element, point);
  return (
    local.x >= element.x &&
    local.x <= element.x + element.width &&
    local.y >= element.y &&
    local.y <= element.y + element.height
  );
}

/** The four corners of the rotated bounding box, in document space. */
export function cornerPoints(element: DesignElement): Record<
  "nw" | "ne" | "se" | "sw",
  Point
> {
  const center = elementCenter(element);
  const { x, y, width, height, rotation } = element;
  return {
    nw: rotatePoint({ x, y }, center, rotation),
    ne: rotatePoint({ x: x + width, y }, center, rotation),
    se: rotatePoint({ x: x + width, y: y + height }, center, rotation),
    sw: rotatePoint({ x, y: y + height }, center, rotation),
  };
}

export function rotationHandlePoint(
  element: DesignElement,
  zoom: number,
): Point {
  const center = elementCenter(element);
  const distance = ROTATION_HANDLE_DISTANCE / zoom;
  return rotatePoint(
    { x: center.x, y: element.y - distance },
    center,
    element.rotation,
  );
}

export function handlePositions(
  element: DesignElement,
  zoom: number,
): Record<HandleId, Point> {
  return { ...cornerPoints(element), rotate: rotationHandlePoint(element, zoom) };
}

/** Returns the handle under `point`, or null. `zoom` keeps hit areas screen-sized. */
export function hitTestHandle(
  element: DesignElement,
  point: Point,
  zoom: number,
): HandleId | null {
  const tolerance = HANDLE_SIZE / zoom;
  const positions = handlePositions(element, zoom);
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

/** The corner diagonally opposite `handle`; it stays pinned while resizing. */
function oppositeCorner(handle: Exclude<HandleId, "rotate">): Exclude<
  HandleId,
  "rotate"
> {
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

/**
 * Resizes by dragging a corner handle to `point`, keeping the opposite corner
 * fixed in document space and respecting the element's rotation.
 */
export function resizeElement(
  element: DesignElement,
  handle: Exclude<HandleId, "rotate">,
  point: Point,
): Rect {
  const anchor = cornerPoints(element)[oppositeCorner(handle)];
  // Pointer expressed in the element's unrotated frame, relative to the anchor.
  const local = rotatePoint(point, anchor, -element.rotation);
  const signX = handle === "ne" || handle === "se" ? 1 : -1;
  const signY = handle === "se" || handle === "sw" ? 1 : -1;

  const width = Math.max(MIN_ELEMENT_SIZE, signX * (local.x - anchor.x));
  const height = Math.max(MIN_ELEMENT_SIZE, signY * (local.y - anchor.y));

  // The new centre is half a diagonal away from the anchor, back in document space.
  const center = rotatePoint(
    {
      x: anchor.x + (signX * width) / 2,
      y: anchor.y + (signY * height) / 2,
    },
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

/** Angle, in degrees, of `point` seen from the element centre (0 = handle up). */
export function pointerAngle(element: DesignElement, point: Point): number {
  const center = elementCenter(element);
  return toDegrees(Math.atan2(point.y - center.y, point.x - center.x)) + 90;
}
