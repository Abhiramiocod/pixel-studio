import { describe, expect, it } from "vitest";

import { editorReducer } from "@/editor/state";
import { findElement, siblingsOf } from "@/models/design";
import { elementBounds } from "@/engine/transformations";
import { dispatchAll, shapeAt, stateWithElements } from "./helpers";

describe("alignment through the editor", () => {
  it("aligns a lone element to the canvas", () => {
    const shape = shapeAt(0, 0, 200, 100);
    const { state } = stateWithElements([shape]);

    const centred = dispatchAll(
      state,
      { type: "select", ids: [shape.id], mode: "replace" },
      { type: "align", mode: "center-horizontal" },
    );
    expect(findElement(centred.document, shape.id)?.x).toBe(440);
  });

  it("aligns a multi-selection to its shared bounds and undoes in one step", () => {
    const a = shapeAt(0, 0, 100, 100);
    const b = shapeAt(300, 200, 100, 100);
    const { state } = stateWithElements([a, b]);

    const aligned = dispatchAll(
      state,
      { type: "select", ids: [a.id, b.id], mode: "replace" },
      { type: "align", mode: "top" },
    );
    expect(findElement(aligned.document, b.id)?.y).toBe(0);
    expect(findElement(aligned.document, a.id)?.y).toBe(0);

    const undone = editorReducer(aligned, { type: "undo" });
    expect(findElement(undone.document, b.id)?.y).toBe(200);
  });

  it("distributes three elements evenly", () => {
    const shapes = [
      shapeAt(0, 0, 100, 100),
      shapeAt(150, 0, 100, 100),
      shapeAt(600, 0, 100, 100),
    ];
    const { state, ids } = stateWithElements(shapes);

    const distributed = dispatchAll(
      state,
      { type: "select", ids, mode: "replace" },
      { type: "distribute", axis: "horizontal" },
    );
    expect(findElement(distributed.document, ids[1])?.x).toBe(300);
  });

  it("aligns a nested child inside its parent's space", () => {
    const a = shapeAt(0, 0, 100, 100);
    const b = shapeAt(300, 300, 100, 100);
    const { state } = stateWithElements([a, b]);
    const grouped = dispatchAll(
      state,
      { type: "select", ids: [a.id, b.id], mode: "replace" },
      { type: "group" },
    );
    const group = grouped.document.elements[0];
    const rotated = editorReducer(grouped, {
      type: "transform",
      changes: [{ id: group.id, patch: { rotation: 90 } }],
      session: null,
    });

    const child = siblingsOf(rotated.document, group.id)[1];
    const aligned = dispatchAll(
      rotated,
      { type: "select", ids: [child.id], mode: "replace" },
      { type: "align", mode: "left" },
    );

    // Aligning to the canvas moves the child to x=0 in *document* space, even
    // though its own coordinates live in a rotated parent.
    expect(elementBounds(aligned.document, child).x).toBeCloseTo(0, 6);
  });
});
