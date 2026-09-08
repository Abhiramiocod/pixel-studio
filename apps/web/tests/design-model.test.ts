import { describe, expect, it } from "vitest";

import { applyPatch, createDocument, findElement, flattenElements, insertElement, locateElement, moveElementToIndex, removeElement, siblingsOf, subtreeIds, targetLayerIndex, updateElement } from "@/models/design";
import { MIN_ELEMENT_SIZE, cloneElementTree, createShape, createText, isContainer } from "@/models/elements";
import { documentWith, frameAt, groupAt, shapeAt, textAt } from "./helpers";

describe("document model", () => {
  it("creates an empty 1080x1080 document", () => {
    const doc = createDocument();
    expect(doc.width).toBe(1080);
    expect(doc.height).toBe(1080);
    expect(doc.elements).toEqual([]);
  });

  it("creates elements with unique ids", () => {
    const ids = new Set([
      createShape("rectangle").id,
      createShape("ellipse").id,
      createText().id,
    ]);
    expect(ids.size).toBe(3);
  });

  it("inserts, updates and deletes elements", () => {
    const shape = shapeAt(10, 20, 100, 50);
    let doc = insertElement(createDocument(), null, 0, shape);
    expect(doc.elements).toHaveLength(1);

    doc = updateElement(doc, shape.id, { x: 99, rotation: 30 });
    expect(findElement(doc, shape.id)?.x).toBe(99);
    expect(findElement(doc, shape.id)?.rotation).toBe(30);

    doc = removeElement(doc, shape.id);
    expect(doc.elements).toHaveLength(0);
    expect(findElement(doc, shape.id)).toBeNull();
  });

  it("does not mutate the input document", () => {
    const shape = shapeAt(0, 0, 10, 10);
    const doc = documentWith([shape]);
    const next = updateElement(doc, shape.id, { x: 500 });
    expect(doc.elements[0].x).toBe(0);
    expect(next.elements[0].x).toBe(500);
  });

  it("ignores patch keys that do not apply to the element type", () => {
    const text = createText();
    const patched = applyPatch(text, { fill: { type: "solid", color: "#f00", opacity: 1 } });
    expect(patched.type).toBe("text");
    expect("fill" in patched).toBe(false);
  });

  it("merges text style patches field by field", () => {
    const text = createText();
    const patched = applyPatch(text, { style: { fontSize: 12 } });
    expect(patched.type === "text" && patched.style.fontSize).toBe(12);
    expect(patched.type === "text" && patched.style.color).toBe(
      text.style.color,
    );
  });

  it("clamps sizes and opacity", () => {
    const shape = shapeAt(0, 0, 100, 100);
    const patched = applyPatch(shape, { width: -50, opacity: 4 });
    expect(patched.width).toBe(MIN_ELEMENT_SIZE);
    expect(patched.opacity).toBe(1);
  });
});

describe("nested groups and frames", () => {
  const child = shapeAt(0, 0, 100, 100);
  const text = textAt(120, 0);
  const inner = groupAt(0, 0, 220, 100, [child, text]);
  const frame = frameAt(50, 50, 400, 400, [inner]);
  const doc = documentWith([frame]);

  it("locates elements at any depth", () => {
    const location = locateElement(doc, child.id);
    expect(location?.parentId).toBe(inner.id);
    expect(location?.index).toBe(0);
    expect(location?.ancestors.map((a) => a.id)).toEqual([frame.id, inner.id]);
  });

  it("flattens the whole tree", () => {
    expect(flattenElements(doc).map((element) => element.id)).toEqual([
      frame.id,
      inner.id,
      child.id,
      text.id,
    ]);
  });

  it("collects subtree ids", () => {
    expect(subtreeIds(frame)).toEqual([frame.id, inner.id, child.id, text.id]);
  });

  it("updates a deeply nested element in place", () => {
    const next = updateElement(doc, text.id, { x: 999 });
    expect(findElement(next, text.id)?.x).toBe(999);
    expect(locateElement(next, text.id)?.parentId).toBe(inner.id);
  });

  it("removes a nested element without touching its siblings", () => {
    const next = removeElement(doc, child.id);
    expect(findElement(next, child.id)).toBeNull();
    expect(findElement(next, text.id)).not.toBeNull();
    expect(siblingsOf(next, inner.id)).toHaveLength(1);
  });

  it("recognises containers", () => {
    expect(isContainer(frame)).toBe(true);
    expect(isContainer(inner)).toBe(true);
    expect(isContainer(child)).toBe(false);
  });

  it("clones a subtree with fresh ids throughout", () => {
    const copy = cloneElementTree(frame);
    const originalIds = new Set(subtreeIds(frame));
    const copyIds = subtreeIds(copy);
    expect(copyIds).toHaveLength(originalIds.size);
    expect(copyIds.some((id) => originalIds.has(id))).toBe(false);
  });
});

describe("layer ordering", () => {
  it("computes target indices for each direction", () => {
    expect(targetLayerIndex(1, 4, "forward")).toBe(2);
    expect(targetLayerIndex(1, 4, "backward")).toBe(0);
    expect(targetLayerIndex(1, 4, "front")).toBe(3);
    expect(targetLayerIndex(1, 4, "back")).toBe(0);
  });

  it("clamps at the ends", () => {
    expect(targetLayerIndex(3, 4, "forward")).toBe(3);
    expect(targetLayerIndex(0, 4, "backward")).toBe(0);
  });

  it("moves an element among its siblings only", () => {
    const a = shapeAt(0, 0, 10, 10);
    const b = shapeAt(0, 0, 10, 10);
    const c = shapeAt(0, 0, 10, 10);
    const group = groupAt(0, 0, 10, 10, [a, b, c]);
    const doc = documentWith([group, shapeAt(0, 0, 10, 10)]);

    const next = moveElementToIndex(doc, a.id, 2);
    const children = siblingsOf(next, group.id).map((child) => child.id);
    expect(children).toEqual([b.id, c.id, a.id]);
    expect(next.elements).toHaveLength(2);
  });
});
