/**
 * Document operations - the unit of undo/redo.
 *
 * Every mutation of a `DesignDocument` is expressed as an `Operation` that can
 * be applied and inverted. History therefore stores intent (what changed), not
 * copies of the whole document.
 */

import {
  applyPatch,
  indexOfElement,
  insertElement,
  moveElementToIndex,
  removeElement,
  updateElement,
  type DesignDocument,
  type DesignElement,
  type ElementPatch,
} from "@/models/design";

export type Operation =
  | { kind: "insert"; index: number; element: DesignElement }
  | { kind: "remove"; index: number; element: DesignElement }
  | { kind: "patch"; id: string; before: ElementPatch; after: ElementPatch }
  | { kind: "reorder"; id: string; from: number; to: number };

export function applyOperation(
  doc: DesignDocument,
  operation: Operation,
): DesignDocument {
  switch (operation.kind) {
    case "insert":
      return insertElement(doc, operation.element, operation.index);
    case "remove":
      return removeElement(doc, operation.element.id);
    case "patch":
      return updateElement(doc, operation.id, operation.after);
    case "reorder":
      return moveElementToIndex(doc, operation.id, operation.to);
  }
}

export function invertOperation(operation: Operation): Operation {
  switch (operation.kind) {
    case "insert":
      return { ...operation, kind: "remove" };
    case "remove":
      return { ...operation, kind: "insert" };
    case "patch":
      return {
        kind: "patch",
        id: operation.id,
        before: operation.after,
        after: operation.before,
      };
    case "reorder":
      return {
        kind: "reorder",
        id: operation.id,
        from: operation.to,
        to: operation.from,
      };
  }
}

export function applyOperations(
  doc: DesignDocument,
  operations: readonly Operation[],
): DesignDocument {
  return operations.reduce(applyOperation, doc);
}

/** Inverts a batch: the operations are undone in reverse order. */
export function invertOperations(
  operations: readonly Operation[],
): Operation[] {
  return [...operations].reverse().map(invertOperation);
}

const PATCH_KEYS = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "opacity",
  "fill",
  "text",
  "fontSize",
  "fontFamily",
  "color",
  "align",
] as const;

/**
 * Reads the element's current values for exactly the keys present in `template`.
 * This is the "before" half of a patch operation.
 */
export function extractPatch(
  element: DesignElement,
  template: ElementPatch,
): ElementPatch {
  const before: ElementPatch = {};

  for (const key of PATCH_KEYS) {
    if (template[key] === undefined) continue;

    switch (key) {
      case "x":
        before.x = element.x;
        break;
      case "y":
        before.y = element.y;
        break;
      case "width":
        before.width = element.width;
        break;
      case "height":
        before.height = element.height;
        break;
      case "rotation":
        before.rotation = element.rotation;
        break;
      case "opacity":
        before.opacity = element.opacity;
        break;
      case "fill":
        if (element.type === "rectangle") before.fill = element.fill;
        break;
      case "text":
        if (element.type === "text") before.text = element.text;
        break;
      case "fontSize":
        if (element.type === "text") before.fontSize = element.fontSize;
        break;
      case "fontFamily":
        if (element.type === "text") before.fontFamily = element.fontFamily;
        break;
      case "color":
        if (element.type === "text") before.color = element.color;
        break;
      case "align":
        if (element.type === "text") before.align = element.align;
        break;
    }
  }

  return before;
}

/** Builds the patch operation for `patch`, or null when nothing would change. */
export function createPatchOperation(
  doc: DesignDocument,
  id: string,
  patch: ElementPatch,
): Operation | null {
  const element = doc.elements.find((item) => item.id === id);
  if (!element) return null;

  const before = extractPatch(element, patch);
  const after = extractPatch(applyPatch(element, patch), patch);
  if (PATCH_KEYS.every((key) => before[key] === after[key])) return null;

  return { kind: "patch", id, before, after };
}

export function createReorderOperation(
  doc: DesignDocument,
  id: string,
  to: number,
): Operation | null {
  const from = indexOfElement(doc, id);
  if (from === -1 || from === to) return null;
  return { kind: "reorder", id, from, to };
}

/**
 * Folds a continuous interaction into a single undo step: consecutive patch
 * batches over the same elements keep the original "before" and take the latest
 * "after". Returns null when the batches cannot be merged.
 */
export function mergePatchOperations(
  previous: readonly Operation[],
  next: readonly Operation[],
): Operation[] | null {
  if (previous.length !== next.length) return null;

  const merged: Operation[] = [];
  for (let i = 0; i < previous.length; i += 1) {
    const a = previous[i];
    const b = next[i];
    if (a.kind !== "patch" || b.kind !== "patch" || a.id !== b.id) return null;
    merged.push({
      kind: "patch",
      id: a.id,
      before: { ...b.before, ...a.before },
      after: { ...a.after, ...b.after },
    });
  }
  return merged;
}
