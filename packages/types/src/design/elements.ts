/**
 * The element tree of a design document.
 *
 * `DesignElement` is a discriminated union on `type`. Containers (group, frame)
 * hold children, so a document is a tree rather than a flat list.
 *
 * Coordinate convention: an element's `x`/`y`/`width`/`height`/`rotation` are
 * expressed in its **parent's content space** - the parent's unrotated box with
 * the origin at its top-left. Top-level elements are therefore in document
 * coordinates, and a container moves or rotates its whole subtree for free.
 */

import type { Border, Fill, Shadow, TextStyle } from "./styles";

export interface BaseElement {
  readonly id: string;
  /** User-facing name shown in the layers panel. */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise degrees around the element centre. */
  rotation: number;
  /** 0..1, multiplied into children for containers. */
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "star"
  | "line"
  | "arrow";

/** A point in normalised element coordinates (0..1 across the box). */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * Per-kind geometry. Keeping this a nested union means a shape only carries the
 * parameters it actually has, while all shapes still share one element type.
 */
export type ShapeGeometry =
  | { kind: "rectangle"; cornerRadius: number }
  | { kind: "ellipse" }
  | { kind: "triangle" }
  | { kind: "polygon"; sides: number }
  | { kind: "star"; points: number; innerRatio: number }
  | { kind: "line"; start: NormalizedPoint; end: NormalizedPoint }
  | {
      kind: "arrow";
      start: NormalizedPoint;
      end: NormalizedPoint;
      headSize: number;
    };

export interface ShapeElement extends BaseElement {
  readonly type: "shape";
  geometry: ShapeGeometry;
  fill: Fill;
  border: Border | null;
  shadow: Shadow | null;
}

export interface TextElement extends BaseElement {
  readonly type: "text";
  text: string;
  style: TextStyle;
  shadow: Shadow | null;
}

/** Region of the source image that is displayed, in natural pixels. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageElement extends BaseElement {
  readonly type: "image";
  /** Object URL, data URL or - once storage exists - a remote asset URL. */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Cropping never discards the source: only this window changes. */
  crop: CropRect;
  flipX: boolean;
  flipY: boolean;
  cornerRadius: number;
  border: Border | null;
  shadow: Shadow | null;
}

export interface GroupElement extends BaseElement {
  readonly type: "group";
  children: DesignElement[];
}

export interface FrameElement extends BaseElement {
  readonly type: "frame";
  children: DesignElement[];
  fill: Fill;
  /** Hides anything outside the frame box. */
  clipContent: boolean;
  cornerRadius: number;
  border: Border | null;
  shadow: Shadow | null;
}

export type DesignElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | GroupElement
  | FrameElement;

export type ContainerElement = GroupElement | FrameElement;

export type ElementType = DesignElement["type"];
