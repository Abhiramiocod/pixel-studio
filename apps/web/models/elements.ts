/**
 * Element factories and helpers.
 *
 * The element *shapes* live in `@pixel-studio/types`; this module creates them
 * and answers structural questions about them. Keeping the two apart means the
 * API can understand a document without importing any editor code.
 */

import type {
  ContainerElement,
  DesignElement,
  FrameElement,
  GroupElement,
  ImageElement,
  ShapeElement,
  ShapeGeometry,
  ShapeKind,
  TextElement,
} from "@pixel-studio/types";
import {
  DEFAULT_BORDER,
  DEFAULT_TEXT_STYLE,
  createSolidFill,
} from "@/models/styles";

export const MIN_ELEMENT_SIZE = 4;

let idCounter = 0;

/** Unique within a document; ids only need to be stable, not globally unique. */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function isContainer(
  element: DesignElement,
): element is ContainerElement {
  return element.type === "group" || element.type === "frame";
}

export function childrenOf(element: DesignElement): DesignElement[] {
  return isContainer(element) ? element.children : [];
}

/** Returns a copy of `element` with new children; type-safe for containers. */
export function withChildren(
  element: DesignElement,
  children: DesignElement[],
): DesignElement {
  switch (element.type) {
    case "group":
      return { ...element, children };
    case "frame":
      return { ...element, children };
    default:
      return element;
  }
}

interface BoxInit {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BaseInit {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

function baseElement(id: string, name: string, box: BoxInit): BaseInit {
  return {
    id,
    name,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
  };
}

export function defaultGeometry(kind: ShapeKind): ShapeGeometry {
  switch (kind) {
    case "rectangle":
      return { kind: "rectangle", cornerRadius: 0 };
    case "ellipse":
      return { kind: "ellipse" };
    case "triangle":
      return { kind: "triangle" };
    case "polygon":
      return { kind: "polygon", sides: 6 };
    case "star":
      return { kind: "star", points: 5, innerRatio: 0.45 };
    case "line":
      return { kind: "line", start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
    case "arrow":
      return {
        kind: "arrow",
        start: { x: 0, y: 0.5 },
        end: { x: 1, y: 0.5 },
        headSize: 24,
      };
  }
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  polygon: "Polygon",
  star: "Star",
  line: "Line",
  arrow: "Arrow",
};

/** True when the shape is drawn as a stroked path rather than a filled area. */
export function isStrokeShape(geometry: ShapeGeometry): boolean {
  return geometry.kind === "line" || geometry.kind === "arrow";
}

const DEFAULT_SHAPE_SIZE = { width: 320, height: 240 };

export function createShape(
  kind: ShapeKind,
  box?: Partial<BoxInit>,
): ShapeElement {
  const stroke = isStrokeShape(defaultGeometry(kind));
  const size = {
    width: box?.width ?? DEFAULT_SHAPE_SIZE.width,
    height: box?.height ?? (stroke ? 8 : DEFAULT_SHAPE_SIZE.height),
  };
  return {
    ...baseElement(createId("shape"), SHAPE_LABELS[kind], {
      x: box?.x ?? 0,
      y: box?.y ?? 0,
      ...size,
    }),
    type: "shape",
    geometry: defaultGeometry(kind),
    fill: createSolidFill(stroke ? "#111827" : "#4f46e5"),
    border: stroke ? { ...DEFAULT_BORDER, width: 6 } : null,
    shadow: null,
  };
}

export function createText(text = "Hello World"): TextElement {
  return {
    ...baseElement(createId("text"), text, {
      x: 0,
      y: 0,
      width: 460,
      height: 100,
    }),
    type: "text",
    text,
    style: { ...DEFAULT_TEXT_STYLE },
    shadow: null,
  };
}

export function createImage(
  src: string,
  naturalWidth: number,
  naturalHeight: number,
  name = "Image",
): ImageElement {
  return {
    ...baseElement(createId("image"), name, {
      x: 0,
      y: 0,
      width: naturalWidth,
      height: naturalHeight,
    }),
    type: "image",
    src,
    naturalWidth,
    naturalHeight,
    crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
    flipX: false,
    flipY: false,
    cornerRadius: 0,
    border: null,
    shadow: null,
  };
}

export function createGroup(
  box: BoxInit,
  children: DesignElement[],
): GroupElement {
  return {
    ...baseElement(createId("group"), "Group", box),
    type: "group",
    children,
  };
}

export function createFrame(box: BoxInit, name = "Frame"): FrameElement {
  return {
    ...baseElement(createId("frame"), name, box),
    type: "frame",
    children: [],
    fill: createSolidFill("#ffffff"),
    clipContent: true,
    cornerRadius: 0,
    border: null,
    shadow: null,
  };
}

/** Deep copy with fresh ids throughout the subtree. */
export function cloneElementTree(element: DesignElement): DesignElement {
  const copy: DesignElement = { ...element, id: createId(element.type) };
  if (isContainer(copy)) {
    return withChildren(copy, copy.children.map(cloneElementTree));
  }
  return copy;
}

/** Label shown in the layers panel. */
export function elementLabel(element: DesignElement): string {
  if (element.type === "text") return element.text.trim() || "Text";
  return element.name;
}
