/**
 * Selection semantics: what a click selects, and where the selection sits.
 * The document stays the source of truth - selection is only a list of ids.
 */

import type { DesignDocument, DesignElement } from "@/models/design";
import type { Point } from "@/engine/coordinates";
import { cornerPoints, hitTestElement } from "@/engine/transformations";

/** Top-most element under `point`, or null. Later elements are on top. */
export function pickElement(
  elements: readonly DesignElement[],
  point: Point,
): DesignElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    if (hitTestElement(element, point)) return element;
  }
  return null;
}

export function getSelectedElements(
  doc: DesignDocument,
  selectedIds: readonly string[],
): DesignElement[] {
  return doc.elements.filter((element) => selectedIds.includes(element.id));
}

/** The single selected element, or null when the selection is empty or plural. */
export function getSoleSelection(
  doc: DesignDocument,
  selectedIds: readonly string[],
): DesignElement | null {
  if (selectedIds.length !== 1) return null;
  return doc.elements.find((element) => element.id === selectedIds[0]) ?? null;
}

export function isSelected(
  selectedIds: readonly string[],
  id: string,
): boolean {
  return selectedIds.includes(id);
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Axis-aligned bounds covering the rotated boxes of every element. */
export function selectionBounds(
  elements: readonly DesignElement[],
): Bounds | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const element of elements) {
    for (const corner of Object.values(cornerPoints(element))) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
