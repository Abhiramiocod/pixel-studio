/**
 * The design document: a tree of elements plus the helpers that read and update
 * it immutably. This module is the single source of truth for design data and
 * stays free of React, canvas and editor concerns.
 *
 * Everything here is plain serializable JSON so a document can be persisted and
 * restored with `JSON.parse` when storage arrives in a later milestone.
 */

import {
  MIN_ELEMENT_SIZE,
  childrenOf,
  createId,
  isContainer,
  withChildren,
  type CropRect,
  type DesignElement,
  type ShapeGeometry,
} from "@/models/elements";
import {
  createSolidFill,
  type Border,
  type Fill,
  type Shadow,
  type TextStyle,
} from "@/models/styles";

export const DESIGN_WIDTH = 1080;
export const DESIGN_HEIGHT = 1080;

export interface DesignDocument {
  readonly id: string;
  name: string;
  width: number;
  height: number;
  background: Fill;
  elements: DesignElement[];
}

export function createDocument(): DesignDocument {
  return {
    id: createId("doc"),
    name: "Untitled design",
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: createSolidFill("#ffffff"),
    elements: [],
  };
}

/* ------------------------------------------------------------------ *
 * Reading the tree
 * ------------------------------------------------------------------ */

/** Where an element sits in the tree. `parentId` is null at the top level. */
export interface ElementLocation {
  element: DesignElement;
  parentId: string | null;
  index: number;
  /** Outermost first, excluding the element itself. */
  ancestors: DesignElement[];
}

export function locateElement(
  doc: DesignDocument,
  id: string,
): ElementLocation | null {
  return locateIn(doc.elements, id, null, []);
}

function locateIn(
  elements: readonly DesignElement[],
  id: string,
  parentId: string | null,
  ancestors: DesignElement[],
): ElementLocation | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element.id === id) return { element, parentId, index, ancestors };
    if (isContainer(element)) {
      const found = locateIn(element.children, id, element.id, [
        ...ancestors,
        element,
      ]);
      if (found) return found;
    }
  }
  return null;
}

export function findElement(
  doc: DesignDocument,
  id: string | null,
): DesignElement | null {
  if (id === null) return null;
  return locateElement(doc, id)?.element ?? null;
}

/** The children list an element belongs to. */
export function siblingsOf(
  doc: DesignDocument,
  parentId: string | null,
): DesignElement[] {
  if (parentId === null) return doc.elements;
  const parent = findElement(doc, parentId);
  return parent ? childrenOf(parent) : [];
}

/** Depth-first walk over the whole tree, containers before their children. */
export function walkElements(
  elements: readonly DesignElement[],
  visit: (element: DesignElement, parentId: string | null) => void,
  parentId: string | null = null,
): void {
  for (const element of elements) {
    visit(element, parentId);
    if (isContainer(element)) {
      walkElements(element.children, visit, element.id);
    }
  }
}

export function flattenElements(doc: DesignDocument): DesignElement[] {
  const all: DesignElement[] = [];
  walkElements(doc.elements, (element) => all.push(element));
  return all;
}

/** Ids of `element` and everything beneath it. */
export function subtreeIds(element: DesignElement): string[] {
  const ids = [element.id];
  walkElements(childrenOf(element), (child) => ids.push(child.id));
  return ids;
}

/* ------------------------------------------------------------------ *
 * Updating the tree
 * ------------------------------------------------------------------ */

/** Rebuilds the children list of `parentId` (or the root) with `mapper`. */
function mapChildList(
  doc: DesignDocument,
  parentId: string | null,
  mapper: (children: DesignElement[]) => DesignElement[],
): DesignDocument {
  if (parentId === null) {
    return { ...doc, elements: mapper(doc.elements) };
  }
  return {
    ...doc,
    elements: mapTree(doc.elements, (element) =>
      element.id === parentId && isContainer(element)
        ? withChildren(element, mapper(element.children))
        : element,
    ),
  };
}

/** Applies `mapper` to every node, rebuilding only the branches that change. */
function mapTree(
  elements: readonly DesignElement[],
  mapper: (element: DesignElement) => DesignElement,
): DesignElement[] {
  return elements.map((element) => {
    const mapped = mapper(element);
    if (!isContainer(mapped)) return mapped;
    const children = mapTree(mapped.children, mapper);
    return children === mapped.children
      ? mapped
      : withChildren(mapped, children);
  });
}

export function insertElement(
  doc: DesignDocument,
  parentId: string | null,
  index: number,
  element: DesignElement,
): DesignDocument {
  return mapChildList(doc, parentId, (children) => {
    const next = [...children];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, element);
    return next;
  });
}

export function removeElement(
  doc: DesignDocument,
  id: string,
): DesignDocument {
  const location = locateElement(doc, id);
  if (!location) return doc;
  return mapChildList(doc, location.parentId, (children) =>
    children.filter((child) => child.id !== id),
  );
}

/** Moves an element to a new index among its current siblings. */
export function moveElementToIndex(
  doc: DesignDocument,
  id: string,
  index: number,
): DesignDocument {
  const location = locateElement(doc, id);
  if (!location) return doc;
  return mapChildList(doc, location.parentId, (children) => {
    const next = [...children];
    const from = next.findIndex((child) => child.id === id);
    if (from === -1) return children;
    const [element] = next.splice(from, 1);
    next.splice(Math.min(Math.max(index, 0), next.length), 0, element);
    return next;
  });
}

export type LayerDirection = "forward" | "backward" | "front" | "back";

/** Target index for a layer command among `count` siblings. */
export function targetLayerIndex(
  current: number,
  count: number,
  direction: LayerDirection,
): number {
  switch (direction) {
    case "forward":
      return Math.min(count - 1, current + 1);
    case "backward":
      return Math.max(0, current - 1);
    case "front":
      return count - 1;
    case "back":
      return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Patching elements
 * ------------------------------------------------------------------ */

/**
 * A partial update. Keys map one-to-one onto element properties; keys that do
 * not apply to the target element type are ignored, which lets one patch be
 * applied across a mixed selection.
 *
 * `style` is merged field-by-field (so changing the font size keeps the colour);
 * every other object-valued key replaces its value wholesale.
 */
export interface ElementPatch {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;

  fill?: Fill;
  border?: Border | null;
  shadow?: Shadow | null;
  geometry?: ShapeGeometry;
  cornerRadius?: number;

  text?: string;
  style?: Partial<TextStyle>;

  crop?: CropRect;
  flipX?: boolean;
  flipY?: boolean;

  clipContent?: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSize(value: number): number {
  return Math.max(MIN_ELEMENT_SIZE, value);
}

/** Geometry fields every element shares. */
function patchBase(element: DesignElement, patch: ElementPatch) {
  return {
    name: patch.name ?? element.name,
    x: patch.x ?? element.x,
    y: patch.y ?? element.y,
    // Lines and arrows are allowed to be flat, so only their box is clamped.
    width: clampSize(patch.width ?? element.width),
    height: clampSize(patch.height ?? element.height),
    rotation: patch.rotation ?? element.rotation,
    opacity: clamp01(patch.opacity ?? element.opacity),
    visible: patch.visible ?? element.visible,
    locked: patch.locked ?? element.locked,
  };
}

function mergeTextStyle(
  style: TextStyle,
  patch: Partial<TextStyle> | undefined,
): TextStyle {
  if (!patch) return style;
  return {
    ...style,
    ...patch,
    fontSize: Math.max(1, patch.fontSize ?? style.fontSize),
    lineHeight: Math.max(0.5, patch.lineHeight ?? style.lineHeight),
  };
}

/** Returns a new element with the patch applied; the input is not mutated. */
export function applyPatch(
  element: DesignElement,
  patch: ElementPatch,
): DesignElement {
  const base = patchBase(element, patch);

  switch (element.type) {
    case "shape":
      return {
        ...element,
        ...base,
        geometry: patch.geometry ?? element.geometry,
        fill: patch.fill ?? element.fill,
        border: patch.border !== undefined ? patch.border : element.border,
        shadow: patch.shadow !== undefined ? patch.shadow : element.shadow,
      };
    case "text":
      return {
        ...element,
        ...base,
        text: patch.text ?? element.text,
        style: mergeTextStyle(element.style, patch.style),
        shadow: patch.shadow !== undefined ? patch.shadow : element.shadow,
      };
    case "image":
      return {
        ...element,
        ...base,
        crop: patch.crop ?? element.crop,
        flipX: patch.flipX ?? element.flipX,
        flipY: patch.flipY ?? element.flipY,
        cornerRadius: Math.max(0, patch.cornerRadius ?? element.cornerRadius),
        border: patch.border !== undefined ? patch.border : element.border,
        shadow: patch.shadow !== undefined ? patch.shadow : element.shadow,
      };
    case "group":
      return { ...element, ...base };
    case "frame":
      return {
        ...element,
        ...base,
        fill: patch.fill ?? element.fill,
        clipContent: patch.clipContent ?? element.clipContent,
        cornerRadius: Math.max(0, patch.cornerRadius ?? element.cornerRadius),
        border: patch.border !== undefined ? patch.border : element.border,
        shadow: patch.shadow !== undefined ? patch.shadow : element.shadow,
      };
  }
}

export function updateElement(
  doc: DesignDocument,
  id: string,
  patch: ElementPatch,
): DesignDocument {
  return {
    ...doc,
    elements: mapTree(doc.elements, (element) =>
      element.id === id ? applyPatch(element, patch) : element,
    ),
  };
}
