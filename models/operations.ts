/**
 * Document operations - the unit of undo/redo.
 *
 * Every mutation is expressed as an `Operation` that can be applied and
 * inverted, so history stores intent rather than copies of the document. The
 * operations are tree-aware: inserts and removals name a parent, and an element
 * carries its whole subtree, so grouping or deleting a group is a single
 * reversible step.
 */

import {
  applyPatch,
  insertElement,
  locateElement,
  moveElementToIndex,
  removeElement,
  updateElement,
  type DesignDocument,
  type ElementPatch,
} from "@/models/design";
import type { DesignElement } from "@/models/elements";
import type { TextStyle } from "@/models/styles";

export type Operation =
  | {
      kind: "insert";
      parentId: string | null;
      index: number;
      element: DesignElement;
    }
  | {
      kind: "remove";
      parentId: string | null;
      index: number;
      element: DesignElement;
    }
  | { kind: "patch"; id: string; before: ElementPatch; after: ElementPatch }
  | { kind: "reorder"; id: string; from: number; to: number };

export function applyOperation(
  doc: DesignDocument,
  operation: Operation,
): DesignDocument {
  switch (operation.kind) {
    case "insert":
      return insertElement(
        doc,
        operation.parentId,
        operation.index,
        operation.element,
      );
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

const TEXT_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "italic",
  "underline",
  "color",
  "align",
  "lineHeight",
  "letterSpacing",
] as const;

function extractTextStyle(
  style: TextStyle,
  template: Partial<TextStyle>,
): Partial<TextStyle> {
  const before: Partial<TextStyle> = {};
  for (const key of TEXT_STYLE_KEYS) {
    if (template[key] === undefined) continue;
    switch (key) {
      case "fontFamily":
        before.fontFamily = style.fontFamily;
        break;
      case "fontSize":
        before.fontSize = style.fontSize;
        break;
      case "fontWeight":
        before.fontWeight = style.fontWeight;
        break;
      case "italic":
        before.italic = style.italic;
        break;
      case "underline":
        before.underline = style.underline;
        break;
      case "color":
        before.color = style.color;
        break;
      case "align":
        before.align = style.align;
        break;
      case "lineHeight":
        before.lineHeight = style.lineHeight;
        break;
      case "letterSpacing":
        before.letterSpacing = style.letterSpacing;
        break;
    }
  }
  return before;
}

/**
 * Reads the element's current values for exactly the keys present in
 * `template` - the "before" half of a patch operation. Keys the element does
 * not have are skipped, so patching a mixed selection stays lossless.
 */
export function extractPatch(
  element: DesignElement,
  template: ElementPatch,
): ElementPatch {
  const before: ElementPatch = {};

  if (template.name !== undefined) before.name = element.name;
  if (template.x !== undefined) before.x = element.x;
  if (template.y !== undefined) before.y = element.y;
  if (template.width !== undefined) before.width = element.width;
  if (template.height !== undefined) before.height = element.height;
  if (template.rotation !== undefined) before.rotation = element.rotation;
  if (template.opacity !== undefined) before.opacity = element.opacity;
  if (template.visible !== undefined) before.visible = element.visible;
  if (template.locked !== undefined) before.locked = element.locked;

  if (template.fill !== undefined && "fill" in element) {
    before.fill = element.fill;
  }
  if (template.border !== undefined && "border" in element) {
    before.border = element.border;
  }
  if (template.shadow !== undefined && "shadow" in element) {
    before.shadow = element.shadow;
  }
  if (template.geometry !== undefined && element.type === "shape") {
    before.geometry = element.geometry;
  }
  if (template.cornerRadius !== undefined && "cornerRadius" in element) {
    before.cornerRadius = element.cornerRadius;
  }
  if (template.text !== undefined && element.type === "text") {
    before.text = element.text;
  }
  if (template.style !== undefined && element.type === "text") {
    before.style = extractTextStyle(element.style, template.style);
  }
  if (template.crop !== undefined && element.type === "image") {
    before.crop = element.crop;
  }
  if (template.flipX !== undefined && element.type === "image") {
    before.flipX = element.flipX;
  }
  if (template.flipY !== undefined && element.type === "image") {
    before.flipY = element.flipY;
  }
  if (template.clipContent !== undefined && element.type === "frame") {
    before.clipContent = element.clipContent;
  }

  return before;
}

/**
 * Both sides are produced by `extractPatch`, so their keys are inserted in the
 * same order and a structural comparison is exact.
 */
function samePatch(a: ElementPatch, b: ElementPatch): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Builds the patch operation for `patch`, or null when nothing would change. */
export function createPatchOperation(
  doc: DesignDocument,
  id: string,
  patch: ElementPatch,
): Operation | null {
  const element = locateElement(doc, id)?.element;
  if (!element) return null;

  const before = extractPatch(element, patch);
  const after = extractPatch(applyPatch(element, patch), patch);
  if (samePatch(before, after)) return null;

  return { kind: "patch", id, before, after };
}

export function createReorderOperation(
  doc: DesignDocument,
  id: string,
  to: number,
): Operation | null {
  const location = locateElement(doc, id);
  if (!location || location.index === to) return null;
  return { kind: "reorder", id, from: location.index, to };
}

/** Removal operation carrying the element's subtree and position. */
export function createRemoveOperation(
  doc: DesignDocument,
  id: string,
): Operation | null {
  const location = locateElement(doc, id);
  if (!location) return null;
  return {
    kind: "remove",
    parentId: location.parentId,
    index: location.index,
    element: location.element,
  };
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
