/**
 * Pointer gestures on the canvas.
 *
 * A gesture is created once on pointer down (`beginGesture`) and asked for the
 * changes it implies on every pointer move (`updateGesture`). All maths happens
 * in document space and is converted into each element's parent space, so a
 * gesture behaves identically at any zoom, pan or nesting depth.
 *
 * Snapping is applied here, to the in-progress movement only: the document is
 * never modified by snapping on its own.
 */

import type {
  DesignDocument,
  DesignElement,
} from "@pixel-studio/types";
import { MIN_ELEMENT_SIZE } from "@/models/elements";
import type { ElementPatch } from "@/models/design";
import { subtreeIds, walkElements } from "@/models/design";
import type { Point } from "@/engine/coordinates";
import type { Bounds } from "@/engine/geometry/bounds";
import {
  captureDescendants,
  hitTestHandle,
  normalizeAngle,
  pointerAngle,
  resizeElement,
  scaleDescendants,
  subtreeBounds,
  toParentDelta,
  toParentSpace,
  type DescendantSnapshot,
  type HandleId,
} from "@/engine/transformations";
import {
  calculateSnap,
  snapThresholdFor,
  type SnapGuide,
} from "@/engine/snapping/snapping";

export interface ElementChange {
  id: string;
  patch: ElementPatch;
}

export interface MoveTarget {
  id: string;
  startX: number;
  startY: number;
}

export type Gesture =
  | {
      kind: "move";
      /** Pointer position at gesture start, in document space. */
      origin: Point;
      targets: MoveTarget[];
      /** Document bounds of the whole selection when the drag started. */
      startBounds: Bounds | null;
    }
  | {
      kind: "resize";
      elementId: string;
      handle: Exclude<HandleId, "rotate">;
      startWidth: number;
      startHeight: number;
      /** Captured only for groups, whose contents scale with the box. */
      descendants: DescendantSnapshot[];
    }
  | {
      kind: "rotate";
      elementId: string;
      /** Difference between pointer angle and element rotation at start. */
      angleOffset: number;
    };

export interface GestureResult {
  changes: ElementChange[];
  guides: SnapGuide[];
}

const EMPTY_RESULT: GestureResult = { changes: [], guides: [] };

/**
 * Decides which gesture a press starts. Handles on a lone selected element win
 * over its body, so a press near a corner resizes rather than moves. Resize and
 * rotate act on a single element; moving supports any number.
 */
export function beginGesture(
  doc: DesignDocument,
  elements: readonly DesignElement[],
  point: Point,
  zoom: number,
): Gesture | null {
  const movable = elements.filter((element) => !element.locked);
  if (movable.length === 0) return null;

  if (movable.length === 1) {
    const element = movable[0];
    const handle = hitTestHandle(doc, element, point, zoom);
    const local = toParentSpace(doc, element.id, point);

    if (handle === "rotate") {
      return {
        kind: "rotate",
        elementId: element.id,
        angleOffset: pointerAngle(element, local) - element.rotation,
      };
    }
    if (handle !== null) {
      return {
        kind: "resize",
        elementId: element.id,
        handle,
        startWidth: element.width,
        startHeight: element.height,
        // Frames keep their children put; groups scale with their contents.
        descendants:
          element.type === "group" ? captureDescendants(element) : [],
      };
    }
  }

  return {
    kind: "move",
    origin: point,
    targets: movable.map((element) => ({
      id: element.id,
      startX: element.x,
      startY: element.y,
    })),
    startBounds: boundsOfElements(doc, movable),
  };
}

function boundsOfElements(
  doc: DesignDocument,
  elements: readonly DesignElement[],
): Bounds | null {
  if (elements.length === 0) return null;
  const all = elements.map((element) => subtreeBounds(doc, element));
  const minX = Math.min(...all.map((bounds) => bounds.x));
  const minY = Math.min(...all.map((bounds) => bounds.y));
  const maxX = Math.max(...all.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...all.map((bounds) => bounds.y + bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Bounds of everything that is not part of the moving selection. */
export function snapTargets(
  doc: DesignDocument,
  movingIds: readonly string[],
): Bounds[] {
  const excluded = new Set<string>();
  for (const id of movingIds) {
    const element = findIn(doc.elements, id);
    if (element) for (const nested of subtreeIds(element)) excluded.add(nested);
  }

  const targets: Bounds[] = [];
  walkElements(doc.elements, (element) => {
    if (excluded.has(element.id) || !element.visible) return;
    targets.push(subtreeBounds(doc, element));
  });
  return targets;
}

function findIn(
  elements: readonly DesignElement[],
  id: string,
): DesignElement | null {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "group" || element.type === "frame") {
      const found = findIn(element.children, id);
      if (found) return found;
    }
  }
  return null;
}

export interface GestureOptions {
  zoom: number;
  /** Snapping can be suppressed, conventionally by holding a modifier. */
  snapping: boolean;
}

/** The changes this gesture implies for the current pointer position. */
export function updateGesture(
  doc: DesignDocument,
  gesture: Gesture,
  point: Point,
  options: GestureOptions,
): GestureResult {
  switch (gesture.kind) {
    case "move":
      return updateMove(doc, gesture, point, options);
    case "resize":
      return updateResize(doc, gesture, point);
    case "rotate":
      return updateRotate(doc, gesture, point);
  }
}

function updateMove(
  doc: DesignDocument,
  gesture: Extract<Gesture, { kind: "move" }>,
  point: Point,
  options: GestureOptions,
): GestureResult {
  let dx = point.x - gesture.origin.x;
  let dy = point.y - gesture.origin.y;
  let guides: SnapGuide[] = [];

  if (options.snapping && gesture.startBounds) {
    const moved: Bounds = {
      ...gesture.startBounds,
      x: gesture.startBounds.x + dx,
      y: gesture.startBounds.y + dy,
    };
    const snap = calculateSnap(
      moved,
      snapTargets(
        doc,
        gesture.targets.map((target) => target.id),
      ),
      { x: 0, y: 0, width: doc.width, height: doc.height },
      snapThresholdFor(options.zoom),
    );
    dx += snap.dx;
    dy += snap.dy;
    guides = snap.guides;
  }

  const changes = gesture.targets.map((target) => {
    // The delta is measured in document space; each element applies it in the
    // space its own coordinates live in.
    const local = toParentDelta(doc, target.id, { x: dx, y: dy });
    return {
      id: target.id,
      patch: { x: target.startX + local.x, y: target.startY + local.y },
    };
  });

  return { changes, guides };
}

function updateResize(
  doc: DesignDocument,
  gesture: Extract<Gesture, { kind: "resize" }>,
  point: Point,
): GestureResult {
  const element = findIn(doc.elements, gesture.elementId);
  if (!element) return EMPTY_RESULT;

  const local = toParentSpace(doc, element.id, point);
  const rect = resizeElement(element, gesture.handle, local, MIN_ELEMENT_SIZE);
  const changes: ElementChange[] = [{ id: element.id, patch: rect }];

  if (gesture.descendants.length > 0) {
    const scaleX = rect.width / Math.max(1e-6, gesture.startWidth);
    const scaleY = rect.height / Math.max(1e-6, gesture.startHeight);
    for (const scaled of scaleDescendants(
      gesture.descendants,
      scaleX,
      scaleY,
      MIN_ELEMENT_SIZE,
    )) {
      changes.push({
        id: scaled.id,
        patch: {
          x: scaled.x,
          y: scaled.y,
          width: scaled.width,
          height: scaled.height,
          ...(scaled.fontSize === null
            ? {}
            : { style: { fontSize: scaled.fontSize } }),
        },
      });
    }
  }

  return { changes, guides: [] };
}

function updateRotate(
  doc: DesignDocument,
  gesture: Extract<Gesture, { kind: "rotate" }>,
  point: Point,
): GestureResult {
  const element = findIn(doc.elements, gesture.elementId);
  if (!element) return EMPTY_RESULT;

  const local = toParentSpace(doc, element.id, point);
  return {
    changes: [
      {
        id: element.id,
        patch: {
          rotation: normalizeAngle(
            pointerAngle(element, local) - gesture.angleOffset,
          ),
        },
      },
    ],
    guides: [],
  };
}

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  rotate: "grab",
};

export function cursorForHandle(handle: HandleId): string {
  return HANDLE_CURSORS[handle];
}
