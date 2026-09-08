/**
 * Design document model.
 *
 * This module is intentionally free of React and canvas code: everything here is
 * plain, serializable data so a document can be persisted (e.g. to a database)
 * and restored later with `JSON.parse`.
 */

export const DESIGN_WIDTH = 1080;
export const DESIGN_HEIGHT = 1080;

/** Smallest allowed element size, in design units. */
export const MIN_ELEMENT_SIZE = 10;

export type ElementType = "rectangle" | "text";

export type TextAlign = "left" | "center" | "right";

/** Geometry and presentation shared by every element. */
export interface BaseElement {
  readonly id: string;
  readonly type: ElementType;
  /** Top-left corner of the unrotated bounding box, in design units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise rotation around the element centre, in degrees. */
  rotation: number;
  /** 0..1 */
  opacity: number;
}

export interface RectangleElement extends BaseElement {
  readonly type: "rectangle";
  fill: string;
}

export interface TextElement extends BaseElement {
  readonly type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: TextAlign;
}

export type DesignElement = RectangleElement | TextElement;

export interface DesignDocument {
  readonly id: string;
  name: string;
  width: number;
  height: number;
  /** CSS colour of the artboard. */
  background: string;
  /** Painted back-to-front: the last element is on top. */
  elements: DesignElement[];
}

/**
 * A partial update for an element. Keys are shared across element types by
 * name, never by meaning, so a patch can be applied without knowing the type.
 */
export interface ElementPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: TextAlign;
}

let idCounter = 0;

/** Stable, collision-free id. Not a UUID: ids only need to be unique per document. */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function createDocument(): DesignDocument {
  return {
    id: createId("doc"),
    name: "Untitled design",
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: "#ffffff",
    elements: [],
  };
}

export function createRectangle(x: number, y: number): RectangleElement {
  return {
    id: createId("rect"),
    type: "rectangle",
    x,
    y,
    width: 320,
    height: 220,
    rotation: 0,
    opacity: 1,
    fill: "#4f46e5",
  };
}

export function createText(x: number, y: number): TextElement {
  return {
    id: createId("text"),
    type: "text",
    x,
    y,
    width: 420,
    height: 90,
    rotation: 0,
    opacity: 1,
    text: "Hello World",
    fontSize: 64,
    fontFamily: "system-ui, sans-serif",
    color: "#111827",
    align: "left",
  };
}

export function findElement(
  doc: DesignDocument,
  id: string | null,
): DesignElement | null {
  if (id === null) return null;
  return doc.elements.find((element) => element.id === id) ?? null;
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSize(value: number): number {
  return Math.max(MIN_ELEMENT_SIZE, value);
}

/** Returns a new element with the patch applied; the input is not mutated. */
export function applyPatch(
  element: DesignElement,
  patch: ElementPatch,
): DesignElement {
  const base = {
    x: patch.x ?? element.x,
    y: patch.y ?? element.y,
    width: clampSize(patch.width ?? element.width),
    height: clampSize(patch.height ?? element.height),
    rotation: patch.rotation ?? element.rotation,
    opacity: clampOpacity(patch.opacity ?? element.opacity),
  };

  switch (element.type) {
    case "rectangle":
      return { ...element, ...base, fill: patch.fill ?? element.fill };
    case "text":
      return {
        ...element,
        ...base,
        text: patch.text ?? element.text,
        fontSize: patch.fontSize ?? element.fontSize,
        fontFamily: patch.fontFamily ?? element.fontFamily,
        color: patch.color ?? element.color,
        align: patch.align ?? element.align,
      };
  }
}

export function addElement(
  doc: DesignDocument,
  element: DesignElement,
): DesignDocument {
  return { ...doc, elements: [...doc.elements, element] };
}

export function updateElement(
  doc: DesignDocument,
  id: string,
  patch: ElementPatch,
): DesignDocument {
  return {
    ...doc,
    elements: doc.elements.map((element) =>
      element.id === id ? applyPatch(element, patch) : element,
    ),
  };
}

export function removeElement(doc: DesignDocument, id: string): DesignDocument {
  return {
    ...doc,
    elements: doc.elements.filter((element) => element.id !== id),
  };
}
