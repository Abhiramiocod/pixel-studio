import { describe, expect, it } from "vitest";

import { editorReducer, type EditorState } from "@/editor/state";
import { findElement, locateElement, siblingsOf } from "@/models/design";
import { createSolidFill } from "@/models/styles";
import { dispatchAll, shapeAt, stateWithElements, textAt } from "./helpers";

const ids = (state: EditorState) =>
  state.document.elements.map((element) => element.id);

describe("elements and selection", () => {
  it("adds multiple elements and selects the newest", () => {
    const shapes = [
      shapeAt(0, 0, 100, 100),
      shapeAt(200, 0, 100, 100),
      textAt(0, 300),
    ];
    const { state } = stateWithElements(shapes);
    expect(state.document.elements).toHaveLength(3);
    expect(state.selectedIds).toEqual([shapes[2].id]);
  });

  it("toggles selection membership", () => {
    const shapes = [shapeAt(0, 0, 10, 10), shapeAt(50, 0, 10, 10)];
    const { state, ids: elementIds } = stateWithElements(shapes);

    const both = dispatchAll(
      state,
      { type: "select", ids: [elementIds[0]], mode: "replace" },
      { type: "select", ids: [elementIds[1]], mode: "toggle" },
    );
    expect(both.selectedIds).toHaveLength(2);

    const one = editorReducer(both, {
      type: "select",
      ids: [elementIds[1]],
      mode: "toggle",
    });
    expect(one.selectedIds).toEqual([elementIds[0]]);
  });

  it("deletes several elements and restores their stacking on undo", () => {
    const shapes = [
      shapeAt(0, 0, 10, 10),
      shapeAt(20, 0, 10, 10),
      shapeAt(40, 0, 10, 10),
    ];
    const { state, ids: elementIds } = stateWithElements(shapes);
    const order = ids(state);

    const deleted = dispatchAll(
      state,
      { type: "select", ids: [elementIds[0], elementIds[1]], mode: "replace" },
      { type: "delete-selected" },
    );
    expect(ids(deleted)).toEqual([elementIds[2]]);

    const restored = editorReducer(deleted, { type: "undo" });
    expect(ids(restored)).toEqual(order);
  });
});

describe("history", () => {
  it("records add, move, resize, rotate and style as separate steps", () => {
    const shape = shapeAt(100, 100, 200, 200);
    const { state } = stateWithElements([shape]);

    const edited = dispatchAll(
      state,
      { type: "transform", changes: [{ id: shape.id, patch: { x: 300 } }], session: null },
      {
        type: "transform",
        changes: [{ id: shape.id, patch: { width: 400, height: 300 } }],
        session: null,
      },
      { type: "transform", changes: [{ id: shape.id, patch: { rotation: 45 } }], session: null },
      {
        type: "transform",
        changes: [{ id: shape.id, patch: { fill: createSolidFill("#ff0000") } }],
        session: null,
      },
    );
    expect(edited.history.past).toHaveLength(5);

    const undone = editorReducer(edited, { type: "undo" });
    const element = findElement(undone.document, shape.id);
    expect(element && element.type === "shape" ? element.fill : null).toEqual(
      shape.fill,
    );
    expect(element?.rotation).toBe(45);
  });

  it("folds one drag session into a single step", () => {
    const shape = shapeAt(0, 0, 100, 100);
    const { state } = stateWithElements([shape]);
    const before = state.history.past.length;

    let dragged = state;
    for (let i = 1; i <= 25; i += 1) {
      dragged = editorReducer(dragged, {
        type: "transform",
        changes: [{ id: shape.id, patch: { x: i, y: i } }],
        session: "drag-1",
      });
    }
    expect(dragged.history.past).toHaveLength(before + 1);
    expect(findElement(dragged.document, shape.id)?.x).toBe(25);

    const undone = editorReducer(dragged, { type: "undo" });
    expect(findElement(undone.document, shape.id)?.x).toBe(0);
  });

  it("invalidates the redo branch after a new change", () => {
    const shape = shapeAt(0, 0, 100, 100);
    const { state } = stateWithElements([shape]);

    const undone = dispatchAll(
      state,
      { type: "transform", changes: [{ id: shape.id, patch: { x: 50 } }], session: null },
      { type: "undo" },
    );
    expect(undone.history.future).toHaveLength(1);

    const branched = editorReducer(undone, {
      type: "transform",
      changes: [{ id: shape.id, patch: { y: 99 } }],
      session: null,
    });
    expect(branched.history.future).toHaveLength(0);
  });

  it("never records a no-op patch", () => {
    const shape = shapeAt(10, 10, 100, 100);
    const { state } = stateWithElements([shape]);
    const same = editorReducer(state, {
      type: "transform",
      changes: [{ id: shape.id, patch: { x: 10 } }],
      session: null,
    });
    expect(same.history.past).toHaveLength(state.history.past.length);
  });
});

describe("clipboard", () => {
  it("copies, pastes with a new id and cascades the offset", () => {
    const shape = shapeAt(200, 200, 100, 100);
    const { state } = stateWithElements([shape]);

    const pasted = dispatchAll(
      state,
      { type: "select", ids: [shape.id], mode: "replace" },
      { type: "copy" },
      { type: "paste" },
    );
    const copy = pasted.document.elements[1];
    expect(copy.id).not.toBe(shape.id);
    expect(copy.x).toBe(220);
    expect(pasted.selectedIds).toEqual([copy.id]);

    const twice = editorReducer(pasted, { type: "paste" });
    expect(twice.document.elements[2].x).toBe(240);
  });

  it("duplicates a group with fresh ids for every descendant", () => {
    const child = shapeAt(0, 0, 50, 50);
    const { state } = stateWithElements([child]);

    const grouped = dispatchAll(
      state,
      { type: "add-element", element: shapeAt(100, 0, 50, 50) },
      { type: "select", ids: ids(state).concat(), mode: "replace" },
    );
    const all = ids(grouped);
    const withGroup = dispatchAll(
      grouped,
      { type: "select", ids: all, mode: "replace" },
      { type: "group" },
      { type: "duplicate" },
    );

    expect(withGroup.document.elements).toHaveLength(2);
    const [original, copy] = withGroup.document.elements;
    expect(copy.id).not.toBe(original.id);
    const originalChildren = siblingsOf(withGroup.document, original.id);
    const copyChildren = siblingsOf(withGroup.document, copy.id);
    expect(copyChildren).toHaveLength(2);
    expect(
      copyChildren.every((element) =>
        originalChildren.every((other) => other.id !== element.id),
      ),
    ).toBe(true);
  });
});

describe("layer ordering through the reducer", () => {
  it("reorders and undoes", () => {
    const shapes = [
      shapeAt(0, 0, 10, 10),
      shapeAt(20, 0, 10, 10),
      shapeAt(40, 0, 10, 10),
    ];
    const { state, ids: elementIds } = stateWithElements(shapes);

    const front = editorReducer(state, {
      type: "reorder",
      id: elementIds[0],
      direction: "front",
    });
    expect(ids(front).at(-1)).toBe(elementIds[0]);

    const undone = editorReducer(front, { type: "undo" });
    expect(ids(undone)).toEqual(elementIds);
  });
});

describe("zoom and pan never touch the document", () => {
  it("keeps element coordinates identical across zoom levels", () => {
    const shape = shapeAt(500, 300, 100, 100);
    const { state } = stateWithElements([shape]);
    const snapshot = JSON.stringify(state.document);

    let zoomed = state;
    for (const zoom of [0.25, 0.5, 1, 2, 4]) {
      zoomed = editorReducer(zoomed, { type: "zoom-to", zoom });
      expect(JSON.stringify(zoomed.document)).toBe(snapshot);
      expect(zoomed.camera.zoom).toBe(zoom);
    }

    const panned = editorReducer(zoomed, { type: "pan-by", dx: -300, dy: 120 });
    expect(JSON.stringify(panned.document)).toBe(snapshot);
    expect(findElement(panned.document, shape.id)?.x).toBe(500);
  });
});

describe("visibility and locking", () => {
  it("are undoable document properties", () => {
    const shape = shapeAt(0, 0, 10, 10);
    const { state } = stateWithElements([shape]);

    const hidden = editorReducer(state, {
      type: "patch-element",
      id: shape.id,
      patch: { visible: false },
      session: null,
    });
    expect(findElement(hidden.document, shape.id)?.visible).toBe(false);

    const shown = editorReducer(hidden, { type: "undo" });
    expect(findElement(shown.document, shape.id)?.visible).toBe(true);
  });
});

describe("nudging", () => {
  it("moves every selected element and is undoable in one step", () => {
    const shapes = [shapeAt(0, 0, 10, 10), shapeAt(100, 0, 10, 10)];
    const { state, ids: elementIds } = stateWithElements(shapes);

    const nudged = dispatchAll(
      state,
      { type: "select", ids: elementIds, mode: "replace" },
      { type: "nudge", dx: 10, dy: -5 },
    );
    expect(findElement(nudged.document, elementIds[0])?.x).toBe(10);
    expect(findElement(nudged.document, elementIds[1])?.x).toBe(110);

    const undone = editorReducer(nudged, { type: "undo" });
    expect(findElement(undone.document, elementIds[0])?.x).toBe(0);
    expect(findElement(undone.document, elementIds[1])?.x).toBe(100);
  });

  it("moves a nested child inside its own parent space", () => {
    const child = shapeAt(10, 10, 50, 50);
    const { state } = stateWithElements([child, shapeAt(200, 0, 50, 50)]);
    const grouped = dispatchAll(
      state,
      { type: "select", ids: ids(state), mode: "replace" },
      { type: "group" },
    );
    const group = grouped.document.elements[0];
    const nested = siblingsOf(grouped.document, group.id)[0];

    const moved = dispatchAll(
      grouped,
      { type: "select", ids: [nested.id], mode: "replace" },
      { type: "nudge", dx: 5, dy: 5 },
    );
    const after = locateElement(moved.document, nested.id);
    expect(after?.parentId).toBe(group.id);
    expect(after?.element.x).toBe(nested.x + 5);
  });
});
