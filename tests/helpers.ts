import {
  createFrame,
  createGroup,
  createShape,
  createText,
  type DesignElement,
  type FrameElement,
  type GroupElement,
  type ShapeElement,
  type ShapeKind,
  type TextElement,
} from "@/models/elements";
import { createDocument, type DesignDocument } from "@/models/design";
import {
  createInitialState,
  editorReducer,
  type EditorAction,
  type EditorState,
} from "@/editor/state";

/** A shape with an explicit box, so tests can assert exact geometry. */
export function shapeAt(
  x: number,
  y: number,
  width: number,
  height: number,
  kind: ShapeKind = "rectangle",
): ShapeElement {
  return { ...createShape(kind), x, y, width, height };
}

export function textAt(
  x: number,
  y: number,
  text = "Hello World",
): TextElement {
  return { ...createText(text), x, y };
}

export function frameAt(
  x: number,
  y: number,
  width: number,
  height: number,
  children: DesignElement[] = [],
): FrameElement {
  return { ...createFrame({ x, y, width, height }), children };
}

export function groupAt(
  x: number,
  y: number,
  width: number,
  height: number,
  children: DesignElement[],
): GroupElement {
  return createGroup({ x, y, width, height }, children);
}

export function documentWith(elements: DesignElement[]): DesignDocument {
  return { ...createDocument(), elements };
}

/** Applies a sequence of actions to a fresh editor state. */
export function run(...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, withViewport());
}

/** Continues from an existing state. */
export function dispatchAll(
  state: EditorState,
  ...actions: EditorAction[]
): EditorState {
  return actions.reduce(editorReducer, state);
}

export function withViewport(): EditorState {
  return editorReducer(createInitialState(), {
    type: "viewport-resized",
    size: { width: 1200, height: 900 },
  });
}

/** Convenience: adds elements and returns [state, ...ids]. */
export function stateWithElements(
  elements: DesignElement[],
): { state: EditorState; ids: string[] } {
  let state = withViewport();
  for (const element of elements) {
    state = editorReducer(state, { type: "add-element", element });
  }
  return { state, ids: elements.map((element) => element.id) };
}
