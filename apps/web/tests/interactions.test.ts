import { describe, expect, it } from "vitest";

import { beginGesture, snapTargets, updateGesture } from "@/engine/interactions";
import {
  hitTestElement,
  normalizeSelection,
  pickDeepest,
  resolveSelection,
  selectionBounds,
} from "@/engine/selection";
import { handlePositions, elementBounds } from "@/engine/transformations";
import { editorReducer } from "@/editor/state";
import { siblingsOf } from "@/models/design";
import {
  documentWith,
  frameAt,
  groupAt,
  shapeAt,
  stateWithElements,
  dispatchAll,
} from "./helpers";

const options = (zoom: number, snapping = false) => ({ zoom, snapping });

describe("drag gestures", () => {
  const shape = shapeAt(100, 100, 200, 100);
  const doc = documentWith([shape]);

  it("moves by the document delta at any zoom", () => {
    for (const zoom of [0.25, 1, 4]) {
      const gesture = beginGesture(doc, [shape], { x: 150, y: 150 }, zoom);
      expect(gesture?.kind).toBe("move");
      const result = updateGesture(doc, gesture!, { x: 200, y: 120 }, options(zoom));
      expect(result.changes[0].patch).toEqual({ x: 150, y: 70 });
    }
  });

  it("moves several elements together", () => {
    const other = shapeAt(500, 500, 50, 50);
    const many = documentWith([shape, other]);
    const gesture = beginGesture(many, [shape, other], { x: 150, y: 150 }, 1);
    const result = updateGesture(many, gesture!, { x: 160, y: 150 }, options(1));
    expect(result.changes).toHaveLength(2);
    expect(result.changes[1].patch).toEqual({ x: 510, y: 500 });
  });

  it("skips locked elements", () => {
    const locked = { ...shape, locked: true };
    expect(beginGesture(documentWith([locked]), [locked], { x: 150, y: 150 }, 1)).toBeNull();
  });

  it("resizes from the handle the press landed on, at any zoom", () => {
    for (const zoom of [0.5, 2]) {
      const handles = handlePositions(doc, shape, zoom);
      const gesture = beginGesture(doc, [shape], handles.se, zoom);
      expect(gesture?.kind).toBe("resize");
      const result = updateGesture(doc, gesture!, { x: 400, y: 300 }, options(zoom));
      expect(result.changes[0].patch).toMatchObject({
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      });
    }
  });

  it("rotates around the centre", () => {
    const handles = handlePositions(doc, shape, 1);
    const gesture = beginGesture(doc, [shape], handles.rotate, 1);
    expect(gesture?.kind).toBe("rotate");
    const result = updateGesture(doc, gesture!, { x: 400, y: 150 }, options(1));
    expect(result.changes[0].patch.rotation).toBeCloseTo(90, 6);
  });
});

describe("snapping during a drag", () => {
  const moving = shapeAt(0, 0, 100, 100);
  const other = shapeAt(400, 300, 200, 200);
  const doc = documentWith([moving, other]);

  it("pulls the element onto a neighbour's edge and reports a guide", () => {
    const gesture = beginGesture(doc, [moving], { x: 50, y: 50 }, 1);
    // Drag so the left edge lands 3px short of the neighbour's left edge.
    const result = updateGesture(doc, gesture!, { x: 447, y: 650 }, options(1, true));
    expect(result.changes[0].patch.x).toBe(400);
    expect(result.guides.some((guide) => guide.axis === "x")).toBe(true);
  });

  it("leaves the drag alone when snapping is off", () => {
    const gesture = beginGesture(doc, [moving], { x: 50, y: 50 }, 1);
    const result = updateGesture(doc, gesture!, { x: 447, y: 650 }, options(1, false));
    expect(result.changes[0].patch.x).toBe(397);
    expect(result.guides).toEqual([]);
  });

  it("never includes the moving element among its own snap targets", () => {
    const targets = snapTargets(doc, [moving.id]);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ x: 400, y: 300 });
  });

  it("excludes the whole moving subtree", () => {
    const child = shapeAt(0, 0, 50, 50);
    const group = groupAt(0, 0, 100, 100, [child]);
    const nested = documentWith([group, other]);
    expect(snapTargets(nested, [group.id])).toHaveLength(1);
  });

  it("snaps in document units, so the pull shrinks as zoom grows", () => {
    const gesture = beginGesture(doc, [moving], { x: 50, y: 50 }, 4);
    // 3 document units away: within reach at 100% but not at 400%.
    const zoomedIn = updateGesture(doc, gesture!, { x: 447, y: 650 }, options(4, true));
    expect(zoomedIn.changes[0].patch.x).toBe(397);
  });
});

describe("resizing a group scales its contents", () => {
  it("scales children and undoes as one step", () => {
    const a = shapeAt(0, 0, 100, 100);
    const b = shapeAt(200, 0, 100, 100);
    const { state } = stateWithElements([a, b]);
    const grouped = dispatchAll(
      state,
      { type: "select", ids: [a.id, b.id], mode: "replace" },
      { type: "group" },
    );
    const group = grouped.document.elements[0];
    const handles = handlePositions(grouped.document, group, 1);

    const gesture = beginGesture(grouped.document, [group], handles.se, 1);
    const result = updateGesture(
      grouped.document,
      gesture!,
      { x: group.x + group.width * 2, y: group.y + group.height * 2 },
      options(1),
    );
    // The group plus both of its children are updated together.
    expect(result.changes).toHaveLength(3);

    const resized = editorReducer(grouped, {
      type: "transform",
      changes: result.changes,
      session: "resize-1",
    });
    const children = siblingsOf(resized.document, group.id);
    expect(children[1].x).toBe(400);
    expect(children[1].width).toBe(200);

    const undone = editorReducer(resized, { type: "undo" });
    expect(siblingsOf(undone.document, group.id)[1]).toMatchObject({
      x: 200,
      width: 100,
    });
  });

  it("leaves a frame's children where they are", () => {
    const child = shapeAt(10, 10, 50, 50);
    const frame = frameAt(0, 0, 200, 200, [child]);
    const doc = documentWith([frame]);
    const handles = handlePositions(doc, frame, 1);

    const gesture = beginGesture(doc, [frame], handles.se, 1);
    const result = updateGesture(doc, gesture!, { x: 400, y: 400 }, options(1));
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].id).toBe(frame.id);
  });
});

describe("picking and selection", () => {
  const child = shapeAt(10, 10, 100, 100);
  const group = groupAt(100, 100, 200, 200, [child]);
  const frameChild = shapeAt(0, 0, 50, 50);
  const frame = frameAt(500, 500, 300, 300, [frameChild]);
  const doc = documentWith([group, frame]);

  it("finds the deepest element under the pointer", () => {
    const hit = pickDeepest(doc, { x: 150, y: 150 }, 1);
    expect(hit?.id).toBe(child.id);
  });

  it("selects the outermost container on a plain click", () => {
    const hit = pickDeepest(doc, { x: 150, y: 150 }, 1)!;
    expect(resolveSelection(doc, hit, false).id).toBe(group.id);
    expect(resolveSelection(doc, hit, true).id).toBe(child.id);
  });

  it("treats a frame as a surface but a group as empty space", () => {
    // Inside the frame but not on its child: the frame itself is picked.
    expect(pickDeepest(doc, { x: 700, y: 700 }, 1)?.id).toBe(frame.id);
    // Inside the group's box but not on its child: nothing is picked.
    expect(pickDeepest(doc, { x: 280, y: 280 }, 1)).toBeNull();
  });

  it("skips hidden and locked elements", () => {
    const hidden = documentWith([{ ...child, visible: false }]);
    expect(pickDeepest(hidden, { x: 50, y: 50 }, 1)).toBeNull();
    const locked = documentWith([{ ...child, locked: true }]);
    expect(pickDeepest(locked, { x: 50, y: 50 }, 1)).toBeNull();
  });

  it("hit-tests rotated elements against their rotated box", () => {
    const rotated = { ...shapeAt(100, 100, 200, 50), rotation: 90 };
    const rotatedDoc = documentWith([rotated]);
    expect(hitTestElement(rotatedDoc, rotated, { x: 200, y: 200 }, 1)).toBe(true);
    expect(hitTestElement(rotatedDoc, rotated, { x: 290, y: 125 }, 1)).toBe(false);
  });

  it("drops ids covered by a selected ancestor", () => {
    expect(normalizeSelection(doc, [group.id, child.id])).toEqual([group.id]);
    expect(normalizeSelection(doc, ["missing"])).toEqual([]);
  });

  it("computes bounds covering rotation and nesting", () => {
    const bounds = selectionBounds(doc, [group, frame]);
    expect(bounds).toMatchObject({ x: 100, y: 100 });
    expect(bounds!.width).toBe(700);
  });

  it("reports a child's document position through its ancestors", () => {
    expect(elementBounds(doc, child)).toMatchObject({ x: 110, y: 110 });
  });
});
