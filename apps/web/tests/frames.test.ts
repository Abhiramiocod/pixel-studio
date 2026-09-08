import { describe, expect, it } from "vitest";

import { editorReducer, type EditorState } from "@/editor/state";
import { locateElement, siblingsOf } from "@/models/design";
import { elementBounds } from "@/engine/transformations";
import { createFrame, createShape, createText } from "@/models/elements";
import { withViewport } from "./helpers";

/** Adds a frame centred on `at` through the public action. */
function addFrame(
  state: EditorState,
  at: { x: number; y: number },
  size = 400,
): { state: EditorState; frameId: string } {
  const next = editorReducer(state, {
    type: "add-element",
    element: createFrame({ x: 0, y: 0, width: size, height: size }),
    at,
  });
  return { state: next, frameId: next.selectedIds[0] };
}

describe("frames as containers", () => {
  it("adds a frame at the top level, centred on the insertion point", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    const location = locateElement(state.document, frameId);
    expect(location?.parentId).toBeNull();
    expect(location?.element).toMatchObject({ x: 200, y: 200 });
  });

  it("parents an element inserted inside the frame", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    const withText = editorReducer(state, {
      type: "add-element",
      element: createText(),
      at: { x: 450, y: 350 },
    });

    const child = locateElement(withText.document, withText.selectedIds[0]);
    expect(child?.parentId).toBe(frameId);
    expect(withText.document.elements).toHaveLength(1);
    expect(siblingsOf(withText.document, frameId)).toHaveLength(1);
  });

  it("stores child coordinates relative to the frame but keeps its world position", () => {
    const { state } = addFrame(withViewport(), { x: 400, y: 400 });
    const withShape = editorReducer(state, {
      type: "add-element",
      element: { ...createShape("rectangle"), width: 100, height: 100 },
      at: { x: 450, y: 350 },
    });
    const child = locateElement(withShape.document, withShape.selectedIds[0])!;

    // Frame origin is (200,200), so a centre of (450,350) is (250,150) inside.
    expect(child.element).toMatchObject({ x: 200, y: 100 });
    const bounds = elementBounds(withShape.document, child.element);
    expect(bounds.x + bounds.width / 2).toBe(450);
    expect(bounds.y + bounds.height / 2).toBe(350);
  });

  it("leaves elements dropped outside the frame at the top level", () => {
    const { state } = addFrame(withViewport(), { x: 400, y: 400 });
    const outside = editorReducer(state, {
      type: "add-element",
      element: createText(),
      at: { x: 900, y: 900 },
    });
    expect(outside.document.elements).toHaveLength(2);
    expect(
      locateElement(outside.document, outside.selectedIds[0])?.parentId,
    ).toBeNull();
  });

  it("never nests a frame inside another frame by insertion", () => {
    const { state } = addFrame(withViewport(), { x: 400, y: 400 });
    const second = addFrame(state, { x: 400, y: 400 }, 100);
    expect(second.state.document.elements).toHaveLength(2);
  });

  it("accounts for the frame's rotation when converting the point", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    const rotated = editorReducer(state, {
      type: "transform",
      changes: [{ id: frameId, patch: { rotation: 90 } }],
      session: null,
    });
    const withShape = editorReducer(rotated, {
      type: "add-element",
      element: { ...createShape("rectangle"), width: 100, height: 100 },
      at: { x: 450, y: 350 },
    });

    const child = locateElement(withShape.document, withShape.selectedIds[0])!;
    expect(child.parentId).toBe(frameId);
    // Whatever the local coordinates are, the world position is what was asked.
    const bounds = elementBounds(withShape.document, child.element);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(450, 6);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(350, 6);
  });

  it("picks the innermost frame when frames are nested", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    // Nest a frame by hand, since insertion deliberately refuses to.
    const outer = state.document.elements[0];
    const inner = createFrame({ x: 50, y: 50, width: 100, height: 100 });
    const nested: EditorState = {
      ...state,
      document: {
        ...state.document,
        elements: [
          outer.type === "frame" ? { ...outer, children: [inner] } : outer,
        ],
      },
    };

    const withShape = editorReducer(nested, {
      type: "add-element",
      element: { ...createShape("rectangle"), width: 20, height: 20 },
      at: { x: 300, y: 300 },
    });
    const child = locateElement(withShape.document, withShape.selectedIds[0]);
    expect(child?.parentId).toBe(inner.id);
    expect(child?.ancestors.map((a) => a.id)).toEqual([frameId, inner.id]);
  });
});

describe("moving a frame", () => {
  it("carries its children through document space", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    const withShape = editorReducer(state, {
      type: "add-element",
      element: { ...createShape("rectangle"), width: 100, height: 100 },
      at: { x: 450, y: 350 },
    });
    const child = siblingsOf(withShape.document, frameId)[0];
    const before = elementBounds(withShape.document, child);

    const moved = editorReducer(withShape, {
      type: "transform",
      changes: [{ id: frameId, patch: { x: 300, y: 250 } }],
      session: null,
    });
    const after = elementBounds(moved.document, child);
    expect(after.x).toBe(before.x + 100);
    expect(after.y).toBe(before.y + 50);
    // The child itself was never touched.
    expect(siblingsOf(moved.document, frameId)[0]).toMatchObject({
      x: child.x,
      y: child.y,
    });
  });

  it("deletes the frame with its contents and restores both on undo", () => {
    const { state, frameId } = addFrame(withViewport(), { x: 400, y: 400 });
    const withShape = editorReducer(state, {
      type: "add-element",
      element: { ...createShape("rectangle"), width: 100, height: 100 },
      at: { x: 450, y: 350 },
    });

    const deleted = editorReducer(
      { ...withShape, selectedIds: [frameId] },
      { type: "delete-selected" },
    );
    expect(deleted.document.elements).toHaveLength(0);

    const undone = editorReducer(deleted, { type: "undo" });
    expect(undone.document.elements).toHaveLength(1);
    expect(siblingsOf(undone.document, frameId)).toHaveLength(1);
  });
});
