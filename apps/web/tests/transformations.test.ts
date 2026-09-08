import { describe, expect, it } from "vitest";

import {
  elementBounds,
  handlePositions,
  hitTestHandle,
  localMatrix,
  pointerAngle,
  resizeElement,
  scaleDescendants,
  captureDescendants,
  subtreeBounds,
  toParentDelta,
  toParentSpace,
  worldMatrix,
} from "@/engine/transformations";
import { applyToPoint } from "@/engine/geometry/matrix";
import { MIN_ELEMENT_SIZE } from "@/models/elements";
import { documentWith, groupAt, shapeAt, textAt } from "./helpers";

const near = (a: number, b: number, tolerance = 1e-6) =>
  Math.abs(a - b) < tolerance;

describe("move", () => {
  it("translates a top-level element by the document delta", () => {
    const shape = shapeAt(100, 100, 200, 100);
    const doc = documentWith([shape]);
    const delta = toParentDelta(doc, shape.id, { x: 40, y: -25 });
    expect(delta).toEqual({ x: 40, y: -25 });
  });

  it("rotates the delta into a rotated parent's space", () => {
    const child = shapeAt(0, 0, 100, 100);
    const group = { ...groupAt(0, 0, 200, 200, [child]), rotation: 90 };
    const doc = documentWith([group]);

    // Moving right in document space means moving down inside a 90deg parent.
    const delta = toParentDelta(doc, child.id, { x: 10, y: 0 });
    expect(near(delta.x, 0)).toBe(true);
    expect(near(delta.y, -10)).toBe(true);
  });
});

describe("resize", () => {
  const shape = shapeAt(200, 200, 400, 300);

  it("keeps the opposite corner pinned when dragging SE", () => {
    const rect = resizeElement(shape, "se", { x: 700, y: 600 }, MIN_ELEMENT_SIZE);
    expect(rect).toEqual({ x: 200, y: 200, width: 500, height: 400 });
  });

  it("moves the origin when dragging NW", () => {
    const rect = resizeElement(shape, "nw", { x: 100, y: 150 }, MIN_ELEMENT_SIZE);
    expect(rect).toEqual({ x: 100, y: 150, width: 500, height: 350 });
  });

  it("respects the minimum size", () => {
    const rect = resizeElement(shape, "se", { x: 0, y: 0 }, MIN_ELEMENT_SIZE);
    expect(rect.width).toBe(MIN_ELEMENT_SIZE);
    expect(rect.height).toBe(MIN_ELEMENT_SIZE);
  });

  it("keeps the pinned corner in place for a rotated element", () => {
    const rotated = { ...shape, rotation: 37 };
    const before = applyToPoint(localMatrix(rotated), {
      x: 0,
      y: 0,
    });
    const rect = resizeElement(
      rotated,
      "se",
      { x: 900, y: 800 },
      MIN_ELEMENT_SIZE,
    );
    const after = applyToPoint(localMatrix({ ...rotated, ...rect }), {
      x: 0,
      y: 0,
    });
    expect(near(before.x, after.x, 1e-9)).toBe(true);
    expect(near(before.y, after.y, 1e-9)).toBe(true);
  });
});

describe("rotate", () => {
  const shape = shapeAt(100, 100, 200, 200);

  it("reads 0 degrees straight above the centre", () => {
    expect(near(pointerAngle(shape, { x: 200, y: 0 }), 0)).toBe(true);
  });

  it("reads 90 degrees to the right of the centre", () => {
    expect(near(pointerAngle(shape, { x: 400, y: 200 }), 90)).toBe(true);
  });

  it("rotates around the element centre, not its origin", () => {
    const rotated = { ...shape, rotation: 180 };
    const matrix = worldMatrix(documentWith([rotated]), rotated.id);
    const corner = applyToPoint(matrix, { x: 0, y: 0 });
    expect(near(corner.x, 300)).toBe(true);
    expect(near(corner.y, 300)).toBe(true);
  });
});

describe("nested transforms", () => {
  const child = shapeAt(20, 30, 100, 50);
  const group = groupAt(200, 100, 300, 200, [child]);
  const doc = documentWith([group]);

  it("composes parent and child positions", () => {
    const bounds = elementBounds(doc, child);
    expect(bounds.x).toBe(220);
    expect(bounds.y).toBe(130);
  });

  it("round-trips a document point into parent space", () => {
    const point = { x: 275, y: 190 };
    const local = toParentSpace(doc, child.id, point);
    expect(near(local.x, 75)).toBe(true);
    expect(near(local.y, 90)).toBe(true);
  });

  it("includes children in subtree bounds", () => {
    const overflowing = shapeAt(-50, 0, 100, 100);
    const container = groupAt(0, 0, 50, 50, [overflowing]);
    const bounds = subtreeBounds(documentWith([container]), container);
    expect(bounds.x).toBe(-50);
    expect(bounds.width).toBe(100);
  });

  it("places handles through every ancestor transform", () => {
    const rotatedGroup = { ...group, rotation: 90 };
    const nested = documentWith([rotatedGroup]);
    const handles = handlePositions(nested, child, 1);
    // The group's centre is (350, 200); rotating the child's NW corner about it.
    expect(near(handles.nw.x, 350 + (200 - 130), 1e-6)).toBe(true);
    expect(near(handles.nw.y, 200 - (350 - 220), 1e-6)).toBe(true);
  });

  it("hit-tests handles within a zoom-scaled tolerance", () => {
    const shape = shapeAt(0, 0, 100, 100);
    const single = documentWith([shape]);
    const handles = handlePositions(single, shape, 1);
    expect(hitTestHandle(single, shape, handles.se, 1)).toBe("se");
    expect(
      hitTestHandle(single, shape, { x: handles.se.x + 40, y: handles.se.y }, 1),
    ).toBeNull();
    // At 25% zoom the same handle covers four times as much document space.
    expect(
      hitTestHandle(
        single,
        shape,
        { x: handles.se.x + 30, y: handles.se.y },
        0.25,
      ),
    ).toBe("se");
  });
});

describe("scaling a group's contents", () => {
  it("scales every descendant, including nested ones", () => {
    const leaf = textAt(10, 10);
    const inner = groupAt(20, 20, 200, 100, [leaf]);
    const outer = groupAt(0, 0, 400, 200, [inner]);

    const snapshot = captureDescendants(outer);
    expect(snapshot.map((item) => item.id)).toEqual([inner.id, leaf.id]);

    const scaled = scaleDescendants(snapshot, 2, 0.5, MIN_ELEMENT_SIZE);
    const scaledInner = scaled.find((item) => item.id === inner.id);
    const scaledLeaf = scaled.find((item) => item.id === leaf.id);

    expect(scaledInner).toMatchObject({ x: 40, y: 10, width: 400, height: 50 });
    expect(scaledLeaf).toMatchObject({ x: 20, y: 5 });
    // Font size follows the geometric mean of the two factors.
    expect(scaledLeaf?.fontSize).toBeCloseTo(leaf.type === "text" ? leaf.style.fontSize : 0, 5);
  });
});
