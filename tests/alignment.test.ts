import { describe, expect, it } from "vitest";

import {
  alignElements,
  distributeElements,
  type AlignTarget,
} from "@/engine/alignment/align";

const targets: AlignTarget[] = [
  { id: "a", bounds: { x: 0, y: 0, width: 100, height: 50 } },
  { id: "b", bounds: { x: 200, y: 100, width: 50, height: 100 } },
  { id: "c", bounds: { x: 400, y: 300, width: 200, height: 20 } },
];

const reference = { x: 0, y: 0, width: 600, height: 320 };

function offsetFor(id: string, offsets: ReturnType<typeof alignElements>) {
  return offsets.find((offset) => offset.id === id) ?? { dx: 0, dy: 0 };
}

describe("alignment", () => {
  it("aligns left", () => {
    const offsets = alignElements(targets, reference, "left");
    expect(offsetFor("b", offsets).dx).toBe(-200);
    expect(offsetFor("c", offsets).dx).toBe(-400);
    // "a" is already aligned, so no offset is produced at all.
    expect(offsets.some((offset) => offset.id === "a")).toBe(false);
  });

  it("aligns horizontal centres", () => {
    const offsets = alignElements(targets, reference, "center-horizontal");
    expect(offsetFor("a", offsets).dx).toBe(250);
    expect(offsetFor("b", offsets).dx).toBe(75);
    expect(offsetFor("c", offsets).dx).toBe(-200);
  });

  it("aligns right", () => {
    const offsets = alignElements(targets, reference, "right");
    expect(offsetFor("a", offsets).dx).toBe(500);
    expect(offsetFor("c", offsets).dx).toBe(0);
  });

  it("aligns top", () => {
    const offsets = alignElements(targets, reference, "top");
    expect(offsetFor("b", offsets).dy).toBe(-100);
    expect(offsetFor("c", offsets).dy).toBe(-300);
  });

  it("aligns vertical middles", () => {
    const offsets = alignElements(targets, reference, "middle");
    expect(offsetFor("a", offsets).dy).toBe(135);
    expect(offsetFor("c", offsets).dy).toBe(-150);
  });

  it("aligns bottom", () => {
    const offsets = alignElements(targets, reference, "bottom");
    expect(offsetFor("a", offsets).dy).toBe(270);
    expect(offsetFor("c", offsets).dy).toBe(0);
  });

  it("only moves along the axis it is asked about", () => {
    for (const offset of alignElements(targets, reference, "left")) {
      expect(offset.dy).toBe(0);
    }
    for (const offset of alignElements(targets, reference, "top")) {
      expect(offset.dx).toBe(0);
    }
  });
});

describe("distribution", () => {
  it("leaves equal gaps horizontally and keeps the outer elements fixed", () => {
    const offsets = distributeElements(targets, "horizontal");
    expect(offsets.map((offset) => offset.id)).toEqual(["b"]);

    // Span 0..600 holds 350px of content, so each of the two gaps is 125px.
    const moved = 100 + 125;
    expect(offsetFor("b", offsets).dx).toBe(moved - 200);
  });

  it("distributes vertically", () => {
    const offsets = distributeElements(targets, "vertical");
    // Span 0..320 holds 170px of content: each gap is 75px.
    expect(offsetFor("b", offsets).dy).toBe(50 + 75 - 100);
  });

  it("needs at least three elements", () => {
    expect(distributeElements(targets.slice(0, 2), "horizontal")).toEqual([]);
  });

  it("is stable: distributing twice changes nothing the second time", () => {
    const first = distributeElements(targets, "horizontal");
    const moved = targets.map((target) => {
      const offset = offsetFor(target.id, first);
      return {
        ...target,
        bounds: { ...target.bounds, x: target.bounds.x + offset.dx },
      };
    });
    expect(distributeElements(moved, "horizontal")).toEqual([]);
  });
});
