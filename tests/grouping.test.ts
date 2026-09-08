import { describe, expect, it } from "vitest";

import { editorReducer, canGroup, canUngroup } from "@/editor/state";
import { findElement, locateElement, siblingsOf } from "@/models/design";
import { elementBounds, subtreeBounds } from "@/engine/transformations";
import { dispatchAll, shapeAt, stateWithElements } from "./helpers";

function grouped() {
  const a = shapeAt(100, 100, 200, 100);
  const b = shapeAt(400, 300, 100, 200);
  const { state } = stateWithElements([a, b]);
  const next = dispatchAll(
    state,
    { type: "select", ids: [a.id, b.id], mode: "replace" },
    { type: "group" },
  );
  return { state: next, a, b, group: next.document.elements[0] };
}

describe("grouping", () => {
  it("wraps the selection in a group sized to its bounds", () => {
    const { state, group } = grouped();
    expect(state.document.elements).toHaveLength(1);
    expect(group.type).toBe("group");
    expect(group).toMatchObject({ x: 100, y: 100, width: 400, height: 400 });
    expect(state.selectedIds).toEqual([group.id]);
  });

  it("keeps children where they were on screen", () => {
    const { state, a, group } = grouped();
    const child = siblingsOf(state.document, group.id)[0];
    expect(child.x).toBe(0);
    expect(child.y).toBe(0);
    // Document-space position is unchanged by grouping.
    expect(elementBounds(state.document, child)).toMatchObject({
      x: a.x,
      y: a.y,
    });
  });

  it("preserves stacking order inside the group", () => {
    const { state, a, b, group } = grouped();
    expect(siblingsOf(state.document, group.id).map((child) => child.id)).toEqual([
      a.id,
      b.id,
    ]);
  });

  it("moving the group moves its children in document space", () => {
    const { state, group } = grouped();
    const child = siblingsOf(state.document, group.id)[0];
    const before = elementBounds(state.document, child);

    const moved = editorReducer(state, {
      type: "transform",
      changes: [{ id: group.id, patch: { x: group.x + 50, y: group.y + 20 } }],
      session: null,
    });
    const after = elementBounds(moved.document, child);
    expect(after.x).toBe(before.x + 50);
    expect(after.y).toBe(before.y + 20);
    // The child's own coordinates never changed - only its parent moved.
    expect(findElement(moved.document, child.id)?.x).toBe(child.x);
  });

  it("rotating the group rotates its children without touching them", () => {
    const { state, group } = grouped();
    const child = siblingsOf(state.document, group.id)[0];

    const rotated = editorReducer(state, {
      type: "transform",
      changes: [{ id: group.id, patch: { rotation: 90 } }],
      session: null,
    });
    expect(findElement(rotated.document, child.id)?.rotation).toBe(0);
    const bounds = elementBounds(rotated.document, child);
    // A 200x100 child becomes 100x200 in document space once rotated.
    expect(Math.round(bounds.width)).toBe(100);
    expect(Math.round(bounds.height)).toBe(200);
  });

  it("undo restores the original elements and order", () => {
    const { state, a, b } = grouped();
    const undone = editorReducer(state, { type: "undo" });
    expect(undone.document.elements.map((element) => element.id)).toEqual([
      a.id,
      b.id,
    ]);
    expect(undone.document.elements[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("refuses to group a single element or elements from different parents", () => {
    const single = stateWithElements([shapeAt(0, 0, 10, 10)]);
    expect(canGroup(single.state)).toBe(false);

    const { state, group } = grouped();
    const child = siblingsOf(state.document, group.id)[0];
    const outer = editorReducer(state, {
      type: "add-element",
      element: shapeAt(700, 700, 50, 50),
    });
    const mixed = editorReducer(outer, {
      type: "select",
      ids: [child.id, outer.document.elements[1].id],
      mode: "replace",
    });
    expect(canGroup(mixed)).toBe(false);
  });
});

describe("ungrouping", () => {
  it("lifts children back into the parent, preserving their world position", () => {
    const { state, group } = grouped();
    const children = siblingsOf(state.document, group.id);
    const worldBefore = children.map((child) =>
      elementBounds(state.document, child),
    );

    const ungrouped = editorReducer(state, { type: "ungroup" });
    expect(ungrouped.document.elements).toHaveLength(2);
    ungrouped.document.elements.forEach((element, index) => {
      const bounds = elementBounds(ungrouped.document, element);
      expect(bounds.x).toBeCloseTo(worldBefore[index].x, 6);
      expect(bounds.y).toBeCloseTo(worldBefore[index].y, 6);
    });
    expect(ungrouped.selectedIds).toHaveLength(2);
  });

  it("carries the group's rotation onto its children", () => {
    const { state, group } = grouped();
    const rotated = editorReducer(state, {
      type: "transform",
      changes: [{ id: group.id, patch: { rotation: 45 } }],
      session: null,
    });
    const ungrouped = editorReducer(rotated, { type: "ungroup" });
    expect(ungrouped.document.elements[0].rotation).toBe(45);
  });

  it("round-trips: group then ungroup restores the geometry", () => {
    const { state } = grouped();
    const ungrouped = editorReducer(state, { type: "ungroup" });
    expect(ungrouped.document.elements[0]).toMatchObject({ x: 100, y: 100 });
    expect(ungrouped.document.elements[1]).toMatchObject({ x: 400, y: 300 });
  });

  it("undo re-creates the group", () => {
    const { state, group } = grouped();
    const undone = editorReducer(
      editorReducer(state, { type: "ungroup" }),
      { type: "undo" },
    );
    expect(undone.document.elements).toHaveLength(1);
    expect(undone.document.elements[0].id).toBe(group.id);
    expect(canUngroup({ ...undone, selectedIds: [group.id] })).toBe(true);
  });
});

describe("nested groups", () => {
  it("supports grouping a group with another element", () => {
    const { state, group } = grouped();
    const withExtra = editorReducer(state, {
      type: "add-element",
      element: shapeAt(700, 100, 100, 100),
    });
    const nested = dispatchAll(
      withExtra,
      {
        type: "select",
        ids: withExtra.document.elements.map((element) => element.id),
        mode: "replace",
      },
      { type: "group" },
    );

    const outer = nested.document.elements[0];
    expect(nested.document.elements).toHaveLength(1);
    expect(siblingsOf(nested.document, outer.id)).toHaveLength(2);

    const inner = locateElement(nested.document, group.id);
    expect(inner?.parentId).toBe(outer.id);
    expect(inner?.ancestors.map((ancestor) => ancestor.id)).toEqual([outer.id]);

    // The outer group spans everything inside it.
    expect(Math.round(subtreeBounds(nested.document, outer).width)).toBe(700);
  });

  it("selecting a nested child normalises away ids covered by a group", () => {
    const { state, group } = grouped();
    const child = siblingsOf(state.document, group.id)[0];
    const both = editorReducer(state, {
      type: "select",
      ids: [group.id, child.id],
      mode: "replace",
    });
    expect(both.selectedIds).toEqual([group.id]);
  });
});
