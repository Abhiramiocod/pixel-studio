/**
 * Selection semantics: what a click selects, and where the selection sits.
 * The document remains the source of truth - selection is only a list of ids.
 */

import type {
  DesignDocument,
  DesignElement,
} from "@pixel-studio/types";
import { childrenOf, isContainer, isStrokeShape } from "@/models/elements";
import { locateElement, subtreeIds } from "@/models/design";
import type { Point } from "@/engine/coordinates";
import { hitTestShape } from "@/engine/geometry/shapes";
import {
  boundsOfPoints,
  type Bounds,
} from "@/engine/geometry/bounds";
import { subtreeBounds, toElementSpace } from "@/engine/transformations";

/** Extra picking slack around thin shapes, in screen pixels. */
const STROKE_PICK_TOLERANCE = 6;

function isPickable(element: DesignElement): boolean {
  return element.visible && !element.locked;
}

/** Hit test one element (not its children) at a document-space point. */
export function hitTestElement(
  doc: DesignDocument,
  element: DesignElement,
  point: Point,
  zoom: number,
): boolean {
  const local = toElementSpace(doc, element.id, point);

  if (element.type === "shape") {
    const tolerance =
      (isStrokeShape(element.geometry)
        ? Math.max(element.border?.width ?? 0, STROKE_PICK_TOLERANCE)
        : 0) +
      STROKE_PICK_TOLERANCE / zoom;
    return hitTestShape(
      element.geometry,
      element.width,
      element.height,
      local,
      tolerance,
    );
  }

  return (
    local.x >= 0 &&
    local.x <= element.width &&
    local.y >= 0 &&
    local.y <= element.height
  );
}

/**
 * The deepest element under `point`, searched front-to-back. Containers are
 * entered before being considered themselves, so a click lands on the child.
 * Groups have no body of their own; frames do.
 */
export function pickDeepest(
  doc: DesignDocument,
  point: Point,
  zoom: number,
  elements: readonly DesignElement[] = doc.elements,
): DesignElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    if (!isPickable(element)) continue;

    if (isContainer(element)) {
      const child = pickDeepest(doc, point, zoom, childrenOf(element));
      if (child) return child;
      // A frame is a real surface; a group is only a container.
      if (element.type === "frame" && hitTestElement(doc, element, point, zoom)) {
        return element;
      }
      continue;
    }

    if (hitTestElement(doc, element, point, zoom)) return element;
  }
  return null;
}

/**
 * What a click should select: the outermost group/frame ancestor by default,
 * or the element itself when the user asks to reach inside (double-click).
 *
 * Selection never descends into a frame's ancestors chain beyond the outermost
 * container, which is the behaviour designers expect from grouped artwork.
 */
export function resolveSelection(
  doc: DesignDocument,
  hit: DesignElement,
  deep: boolean,
): DesignElement {
  if (deep) return hit;
  const location = locateElement(doc, hit.id);
  return location?.ancestors[0] ?? hit;
}

export function getSelectedElements(
  doc: DesignDocument,
  selectedIds: readonly string[],
): DesignElement[] {
  const wanted = new Set(selectedIds);
  const found: DesignElement[] = [];
  const visit = (elements: readonly DesignElement[]) => {
    for (const element of elements) {
      if (wanted.has(element.id)) found.push(element);
      if (isContainer(element)) visit(element.children);
    }
  };
  visit(doc.elements);
  return found;
}

/** The single selected element, or null when the selection is empty or plural. */
export function getSoleSelection(
  doc: DesignDocument,
  selectedIds: readonly string[],
): DesignElement | null {
  if (selectedIds.length !== 1) return null;
  return locateElement(doc, selectedIds[0])?.element ?? null;
}

/**
 * Drops ids that no longer exist, and ids nested inside another selected
 * element - selecting a group implies its contents.
 */
export function normalizeSelection(
  doc: DesignDocument,
  selectedIds: readonly string[],
): string[] {
  const existing = selectedIds.filter((id) => locateElement(doc, id) !== null);
  const covered = new Set<string>();
  for (const id of existing) {
    const element = locateElement(doc, id)?.element;
    if (!element || !isContainer(element)) continue;
    for (const nested of subtreeIds(element)) {
      if (nested !== id) covered.add(nested);
    }
  }
  return existing.filter((id) => !covered.has(id));
}

/** Axis-aligned document bounds covering every selected element's subtree. */
export function selectionBounds(
  doc: DesignDocument,
  elements: readonly DesignElement[],
): Bounds | null {
  const points: Point[] = [];
  for (const element of elements) {
    const bounds = subtreeBounds(doc, element);
    points.push(
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    );
  }
  return boundsOfPoints(points);
}
